package com.megale_varka.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.widget.RemoteViews
import com.megale_varka.R
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class StreakWidget : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
    ) {
        for (id in appWidgetIds) {
            update(context, appWidgetManager, id)
        }
    }

    companion object {
        fun update(context: Context, appWidgetManager: AppWidgetManager, widgetId: Int) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val streak = prefs.getInt(KEY_STREAK, 0)
            val storedRecordedToday = prefs.getBoolean(KEY_RECORDED_TODAY, false)
            val stateDate = prefs.getString(KEY_WIDGET_STATE_DATE, null)
            val recordedToday = storedRecordedToday && stateDate == todayString()

            val views = RemoteViews(context.packageName, R.layout.widget_streak)
            views.setTextViewText(R.id.streak_count, streak.toString())
            views.setImageViewResource(
                R.id.flame_icon,
                if (recordedToday) R.drawable.ic_flame_active else R.drawable.ic_flame_inactive,
            )

            appWidgetManager.updateAppWidget(widgetId, views)
        }

        const val PREFS_NAME = "StreakWidgetPrefs"
        const val KEY_STREAK = "streak"
        const val KEY_RECORDED_TODAY = "recordedToday"
        const val KEY_WIDGET_STATE_DATE = "widgetStateDate"

        private fun todayString(): String {
            val formatter = SimpleDateFormat("yyyy-MM-dd", Locale.US)
            return formatter.format(Date())
        }
    }
}
