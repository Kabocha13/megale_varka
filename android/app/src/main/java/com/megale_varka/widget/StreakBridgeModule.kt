package com.megale_varka.widget

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class StreakBridgeModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "StreakBridge"

    private fun todayString(): String {
        val formatter = SimpleDateFormat("yyyy-MM-dd", Locale.US)
        return formatter.format(Date())
    }

    @ReactMethod
    fun update(streak: Int, recordedToday: Boolean) {
        val prefs = reactContext.getSharedPreferences(StreakWidget.PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit()
            .putInt(StreakWidget.KEY_STREAK, streak)
            .putBoolean(StreakWidget.KEY_RECORDED_TODAY, recordedToday)
            .putString(StreakWidget.KEY_WIDGET_STATE_DATE, todayString())
            .apply()

        val mgr = AppWidgetManager.getInstance(reactContext)
        val ids = mgr.getAppWidgetIds(ComponentName(reactContext, StreakWidget::class.java))
        if (ids.isNotEmpty()) {
            val intent = Intent(reactContext, StreakWidget::class.java).apply {
                action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
            }
            reactContext.sendBroadcast(intent)
        }
    }
}
