import Foundation
import WidgetKit

@objc(StreakBridgeModule)
class StreakBridgeModule: NSObject {

    private static let suiteName = "group.com.megale_varka"
    private static let widgetKind = "StreakWidget"
    private static let widgetStateDateKey = "widgetStateDate"

    private static func todayString() -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: Date())
    }

    @objc
    func update(_ streak: Int, recordedToday: Bool) {
        let defaults = UserDefaults(suiteName: Self.suiteName)
        defaults?.set(streak, forKey: "streak")
        defaults?.set(recordedToday, forKey: "recordedToday")
        defaults?.set(Self.todayString(), forKey: Self.widgetStateDateKey)
        defaults?.synchronize()

        if #available(iOS 14.0, *) {
            WidgetCenter.shared.reloadTimelines(ofKind: Self.widgetKind)
        }
    }

    @objc
    static func requiresMainQueueSetup() -> Bool { false }
}
