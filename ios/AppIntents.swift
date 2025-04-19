import AppIntents
import os // Optional: for logging

// Logger instance (optional, but helpful for debugging)
let logger = Logger(subsystem: Bundle.main.bundleIdentifier!, category: "AppIntents")

// Ensure availability for iOS 16+ where App Intents were introduced
@available(iOS 16.0, *)
struct SayHelloIntent: AppIntent, ProvidesDialog {
  var value: Never?
  
    static var title: LocalizedStringResource = "Say Hello"
    static var description = IntentDescription("A simple action that prints a greeting.")

    @Parameter(title: "Name") // This makes it configurable in Shortcuts
    var personName: String? // Can be optional or required

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let nameToGreet = personName ?? "there" // Use provided name or default
        let greeting = "Hello \(nameToGreet)!"
        logger.info("Greeting: \(greeting)")
        print(greeting)
        return .result(dialog: "\(greeting)")
    }
}

@available(iOS 16.0, *)
struct MyShortcuts: AppShortcutsProvider {
    // This computed property lists the shortcuts your app provides
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: SayHelloIntent(), // Use the intent we just defined
            phrases: [
                // Phrases users might say to Siri or search for
                "Say hello using \(.applicationName)",
                "Perform the hello action in \(.applicationName)"
            ],
            // A shorter title for display in lists
            shortTitle: "Say Hello",
            // An icon from SF Symbols (https://developer.apple.com/sf-symbols/)
            systemImageName: "hand.wave.fill"
        )
        // You could add more AppShortcut(...) instances here for other intents
    }
}
