#!/bin/bash

# Quick MCP Test Runner
echo "🎭 Running Quick MCP Test..."

# Check if device is connected
if ! adb devices | grep -q "device$"; then
    echo "❌ No Android device detected"
    echo "💡 Start emulator with: emulator -avd test_device_arm -no-window -no-audio"
    exit 1
fi

echo "✅ Device detected: $(adb devices | tail -n +2 | head -1)"

# Start log capture
echo "📋 Capturing logs..."
adb logcat -c
adb logcat | grep -E "(NOBRIDGE|MCP|RAG|Error|Failed)" > quick-test-logs.txt &
LOG_PID=$!

# Run the test
echo "🚀 Launching test..."
if maestro test tests/quick-mcp-test.yaml; then
    echo "✅ Quick test completed successfully"
else
    echo "❌ Quick test failed"
fi

# Stop log capture
sleep 2
kill $LOG_PID 2>/dev/null || true

# Show recent relevant logs
echo ""
echo "📋 Recent MCP-related logs:"
tail -20 quick-test-logs.txt | grep -E "(MCP|RAG|Error|SUCCESS|INFO)" || echo "No MCP logs found"

echo ""
echo "🎯 Quick test complete!"
echo "📁 Full logs saved in: quick-test-logs.txt"