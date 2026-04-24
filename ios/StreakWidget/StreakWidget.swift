import WidgetKit
import SwiftUI

// MARK: - Data model

struct StreakEntry: TimelineEntry {
    let date: Date
    let streak: Int
    let recordedToday: Bool
}

// MARK: - Timeline provider

struct StreakProvider: TimelineProvider {
    private static let suiteName = "group.com.megale_varka"
    private static let widgetStateDateKey = "widgetStateDate"

    func placeholder(in context: Context) -> StreakEntry {
        StreakEntry(date: Date(), streak: 7, recordedToday: true)
    }

    func getSnapshot(in context: Context, completion: @escaping (StreakEntry) -> Void) {
        completion(readEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<StreakEntry>) -> Void) {
        let entry = readEntry()
        // Refresh at midnight so the flame resets automatically when the day changes
        let midnight = Calendar.current.nextDate(
            after: Date(),
            matching: DateComponents(hour: 0, minute: 0, second: 0),
            matchingPolicy: .nextTime
        ) ?? Date().addingTimeInterval(3600)
        let timeline = Timeline(entries: [entry], policy: .after(midnight))
        completion(timeline)
    }

    private func readEntry() -> StreakEntry {
        let defaults = UserDefaults(suiteName: Self.suiteName)
        let streak = defaults?.integer(forKey: "streak") ?? 0
        let storedRecordedToday = defaults?.bool(forKey: "recordedToday") ?? false
        let stateDate = defaults?.string(forKey: Self.widgetStateDateKey)
        let recordedToday = storedRecordedToday && stateDate == todayString()
        return StreakEntry(date: Date(), streak: streak, recordedToday: recordedToday)
    }

    private func todayString() -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: Date())
    }
}

// MARK: - Widget view

struct StreakWidgetView: View {
    let entry: StreakEntry

    var body: some View {
        if #available(iOSApplicationExtension 17.0, *) {
            baseContent
                .containerBackground(.regularMaterial, for: .widget)
        } else {
            baseContent
        }
    }

    private var baseContent: some View {
        VStack(spacing: 4) {
            Image(systemName: "flame.fill")
                .font(.system(size: 44))
                .foregroundColor(entry.recordedToday ? .orange : Color(.systemGray3))

            Text("\(entry.streak)")
                .font(.system(size: 26, weight: .bold, design: .rounded))
                .foregroundColor(.primary)

            Text("日連続")
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Widget configuration

struct StreakWidgetMain: Widget {
    let kind = "StreakWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: StreakProvider()) { entry in
            StreakWidgetView(entry: entry)
        }
        .configurationDisplayName("継続記録")
        .description("健康記録の連続日数を炎で表示します")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
