# Compose
-keep class androidx.compose.** { *; }
-dontwarn androidx.compose.**

# Kotlin
-keep class kotlin.** { *; }
-dontwarn kotlin.**

# Bluetooth
-keep class android.bluetooth.** { *; }

# Keep our app classes
-keep class com.dcsf.bms.** { *; }
-keepclassmembers class com.dcsf.bms.** { *; }

# Keep Compose @Composable functions
-if @androidx.compose.runtime.Composable class **
-keep class * {
    @androidx.compose.runtime.Composable <methods>;
}
