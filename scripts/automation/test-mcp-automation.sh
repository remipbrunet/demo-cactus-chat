#!/bin/bash

# Automated MCP Server Testing Script
# This script runs automated tests and captures results for debugging

set -e

echo "🚀 Starting Automated MCP Server Testing"

# Create test results directory
mkdir -p test-results/$(date +%Y%m%d_%H%M%S)
TEST_DIR="test-results/$(date +%Y%m%d_%H%M%S)"

# Function to check if emulator is running
check_emulator() {
    if ! adb devices | grep -q "device$"; then
        echo "📱 No Android device detected. Starting emulator..."
        emulator -avd test_device_arm -no-window -no-audio &
        echo "⏳ Waiting for emulator to boot..."
        adb wait-for-device
        sleep 10  # Extra wait for full boot
    else
        echo "✅ Android device detected"
    fi
}

# Function to install app if needed
install_app() {
    echo "📦 Checking if app is installed..."
    if ! adb shell pm list packages | grep -q "com.rshemetsubuser.myapp"; then
        echo "⚠️ App not installed. Please build and install the app first:"
        echo "   yarn android"
        exit 1
    else
        echo "✅ App is installed"
    fi
}

# Function to capture device logs
capture_logs() {
    echo "📋 Starting log capture..."
    adb logcat -c  # Clear existing logs
    adb logcat | grep -E "(NOBRIDGE|MCP|RAG|Error|Failed)" > "$TEST_DIR/device-logs.txt" &
    LOG_PID=$!
    echo "✅ Log capture started (PID: $LOG_PID)"
}

# Function to run Maestro test
run_maestro_test() {
    local test_file=$1
    local test_name=$(basename "$test_file" .yaml)
    
    echo "🎭 Running Maestro test: $test_name"
    
    if maestro test "$test_file" --format json --output "$TEST_DIR/${test_name}-results.json"; then
        echo "✅ Test $test_name completed successfully"
        return 0
    else
        echo "❌ Test $test_name failed"
        return 1
    fi
}

# Function to analyze results
analyze_results() {
    echo "📊 Analyzing test results..."
    
    # Check for specific error patterns in logs
    if grep -q "RAG query failed" "$TEST_DIR/device-logs.txt"; then
        echo "🐛 BUG DETECTED: RAG query failed error found in logs"
    fi
    
    if grep -q "MCP Client not initialized" "$TEST_DIR/device-logs.txt"; then
        echo "🐛 BUG DETECTED: MCP Client initialization error"
    fi
    
    if grep -q "Invalid response content type" "$TEST_DIR/device-logs.txt"; then
        echo "🐛 BUG DETECTED: Content type error"
    fi
    
    if grep -q "MCP HTTP Response.*200" "$TEST_DIR/device-logs.txt"; then
        echo "✅ SUCCESS: MCP server responded successfully"
    fi
    
    # Count successful vs failed requests
    local success_count=$(grep -c "SUCCESS" "$TEST_DIR/device-logs.txt" || echo "0")
    local error_count=$(grep -c "ERROR\|Failed" "$TEST_DIR/device-logs.txt" || echo "0")
    
    echo "📈 Test Summary:"
    echo "   Successful operations: $success_count"
    echo "   Failed operations: $error_count"
    echo "   Test results saved in: $TEST_DIR"
}

# Function to cleanup
cleanup() {
    echo "🧹 Cleaning up..."
    if [ ! -z "$LOG_PID" ]; then
        kill $LOG_PID 2>/dev/null || true
        echo "✅ Log capture stopped"
    fi
}

# Set up cleanup on exit
trap cleanup EXIT

# Main execution flow
main() {
    echo "📋 Test Configuration:"
    echo "   Test Directory: $TEST_DIR"
    echo "   Device: $(adb devices | tail -n +2 | head -1)"
    echo "   Maestro Version: $(maestro --version 2>/dev/null || echo 'Not found')"
    
    # Pre-flight checks
    check_emulator
    install_app
    capture_logs
    
    # Run basic MCP test
    if run_maestro_test "tests/mcp-server-test.yaml"; then
        echo "✅ Basic MCP test passed"
    else
        echo "❌ Basic MCP test failed, running debug loop..."
        run_maestro_test "tests/mcp-debug-loop.yaml"
    fi
    
    # Wait a bit for final logs
    sleep 5
    
    # Analyze results
    analyze_results
    
    echo ""
    echo "🎯 Automated MCP Testing Complete!"
    echo "📁 Results available in: $TEST_DIR"
    echo ""
    echo "📋 Next steps:"
    echo "   1. Review device logs: cat $TEST_DIR/device-logs.txt"
    echo "   2. Check test results: cat $TEST_DIR/*-results.json"
    echo "   3. View screenshots: ls $TEST_DIR/*.png"
}

# Run main function
main "$@"