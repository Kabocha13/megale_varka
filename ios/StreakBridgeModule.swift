import Foundation
import WidgetKit

@objc(StreakBridgeModule)
class StreakBridgeModule: NSObject {

    private static let suiteName = "group.com.megale_varka"
    private static let widgetKind = "StreakWidget"

    @objc
    func update(_ streak: Int, recordedToday: Bool) {
        let defaults = UserDefaults(suiteName: Self.suiteName)
        defaults?.set(streak, forKey: "streak")
        defaults?.set(recordedToday, forKey: "recordedToday")
        defaults?.synchronize()

        if #available(iOS 14.0, *) {
            WidgetCenter.shared.reloadTimelines(ofKind: Self.widgetKind)
        }
    }

    @objc
    static func requiresMainQueueSetup() -> Bool { false }
}
