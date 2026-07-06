package com.dcsf.bms

import android.Manifest
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.view.WindowManager
import android.view.WindowInsetsController
import android.os.Bundle
import android.util.Log
import android.webkit.WebView
import android.net.Uri
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.os.Environment
import java.io.File
import java.io.FileOutputStream

import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bluetooth
import androidx.compose.material.icons.filled.BluetoothConnected
import androidx.compose.material.icons.filled.BluetoothDisabled
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Terminal
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.compose.material3.SwipeToDismissBox
import androidx.compose.material3.SwipeToDismissBoxValue
import androidx.compose.material3.rememberSwipeToDismissBoxState
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.ui.input.nestedscroll.NestedScrollConnection
import androidx.compose.ui.input.nestedscroll.NestedScrollSource
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.unit.Velocity

object LogCollector {
    private val _buffer = ArrayDeque<String>()
    private val _logs = mutableStateListOf<String>()
    val logs: List<String> get() = _logs
    private const val MAX = 200
    private const val FLUSH_INTERVAL_MS = 500L
    private var lastFlush = 0L
    private val dateFormat = java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.US)

    fun log(tag: String, msg: String) {
        val ts = dateFormat.format(java.util.Date())
        val entry = "$ts $tag $msg"
        synchronized(_buffer) {
            _buffer.addLast(entry)
            if (_buffer.size > MAX) _buffer.removeFirst()
        }
        val now = System.currentTimeMillis()
        if (now - lastFlush > FLUSH_INTERVAL_MS) {
            lastFlush = now
            synchronized(_buffer) {
                _logs.clear()
                _logs.addAll(_buffer)
            }
        }
    }

    fun clear() {
        synchronized(_buffer) { _buffer.clear() }
        _logs.clear()
    }
}

data class AppColors(
    val bg: Color,
    val surface: Color,
    val surfaceConn: Color,
    val surfaceConnBorder: Color,
    val fg: Color,
    val fg2: Color,
    val fg3: Color,
    val border: Color,
    val primary: Color,
    val primaryFg: Color,
    val track: Color,
    val navBg: Color,
    val danger: Color,
    val swipeBg: Color,
) {
    companion object {
        // Colors synced with ui/src/styles/themes/light.css
        val Light = AppColors(
            bg = Color(0xFFF3F5F9),
            surface = Color(0xFFFFFFFF),
            surfaceConn = Color(0xFFECFDF5),
            surfaceConnBorder = Color(0xFFA7F3D0),
            fg = Color(0xFF11161F),
            fg2 = Color(0xFF5D646F),
            fg3 = Color(0xFF9CA3AF),
            border = Color(0xFFDCDEE1),
            primary = Color(0xFF0072D5),
            primaryFg = Color.White,
            track = Color(0xFFDCDEE1),
            navBg = Color.White,
            danger = Color(0xFFEF4444),
            swipeBg = Color(0xFFEF4444),
        )
        // Colors synced with ui/src/styles/themes/dark.css
        val Dark = AppColors(
            bg = Color(0xFF060709),
            surface = Color(0xFF13161B),
            surfaceConn = Color(0xFF0D2818),
            surfaceConnBorder = Color(0xFF166534),
            fg = Color(0xFFE4E8EF),
            fg2 = Color(0xFF88909C),
            fg3 = Color(0xFF6B7280),
            border = Color(0xFF26292E),
            primary = Color(0xFF4BA3F7),
            primaryFg = Color.White,
            track = Color(0xFF26292E),
            navBg = Color(0xFF13161B),
            danger = Color(0xFFF87171),
            swipeBg = Color(0xFFDC2626),
        )
    }
}

fun hasBlePermissions(context: Context): Boolean {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        ContextCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_SCAN) == PackageManager.PERMISSION_GRANTED
    } else {
        ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
    }
}

private var pushLogCounter = 0

fun pushToUi(webView: MutableState<WebView?>, type: String, payloadJson: String) {
    val wv = webView.value ?: return
    // Only log every 10th raw-data push to avoid flooding
    if (type != "bms:raw-data" || pushLogCounter++ % 10 == 0) {
        LogCollector.log("UI", "push $type ${payloadJson.take(60)}")
    }
    try {
        val escapedType = type.replace("'", "\\'")
        val js = "try{if(window.__APP_BRIDGE__&&window.__APP_BRIDGE__._handler){window.__APP_BRIDGE__._handler({type:'" + escapedType + "',payload:" + payloadJson + "})}}catch(e){console.log('BRIDGE:push_error:'+e.message)}"
        wv.post { wv.evaluateJavascript(js, null) }
    } catch (e: Exception) {
        LogCollector.log("UI", "pushToUi error: ${e.message}")
    }
}

class MainActivity : ComponentActivity() {
    private val bleManager = BleManager()
    private var mainWebView: WebView? = null

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { perms ->
        val allGranted = perms.all { it.value }
        if (allGranted) bleManager.startScan(this)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            val darkTheme = isSystemInDarkTheme()
            val c = if (darkTheme) AppColors.Dark else AppColors.Light

            val view = LocalContext.current
            val activity = view as? ComponentActivity
            LaunchedEffect(darkTheme) {
                activity?.window?.statusBarColor = c.bg.toArgb()
                activity?.window?.navigationBarColor = c.navBg.toArgb()
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    val controller = activity?.window?.insetsController
                    if (controller != null) {
                        controller.setSystemBarsAppearance(
                            if (!darkTheme) android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS else 0,
                            android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                        )
                        controller.setSystemBarsAppearance(
                            if (!darkTheme) android.view.WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS else 0,
                            android.view.WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS
                        )
                    }
                } else {
                    val decorView = activity?.window?.decorView
                    var flags = decorView?.systemUiVisibility ?: 0
                    if (!darkTheme) {
                        flags = flags or android.view.View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                            flags = flags or android.view.View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
                        }
                    } else {
                        flags = flags and android.view.View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR.inv()
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                            flags = flags and android.view.View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR.inv()
                        }
                    }
                    decorView?.systemUiVisibility = flags
                }
            }

            MaterialTheme(
                colorScheme = if (darkTheme) darkColorScheme(
                    primary = c.primary,
                    onPrimary = c.primaryFg,
                    surface = c.bg,
                    onSurface = c.fg,
                    background = c.bg,
                    onBackground = c.fg,
                ) else lightColorScheme(
                    primary = c.primary,
                    onPrimary = c.primaryFg,
                    surface = c.bg,
                    onSurface = c.fg,
                    background = c.bg,
                    onBackground = c.fg,
                )
            ) {
                BmsApp(
                    bleManager = bleManager,
                    colors = c,
                    darkTheme = darkTheme,
                    onRequestPermissions = { requestPermissions() },
                    onConnectDevice = { device -> connectDevice(device) },
                    onDisconnect = { disconnect() },
                    onWebViewCreated = { wv -> mainWebView = wv },
                )
            }
        }
    }

    private fun requestPermissions() {
        val perms = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            arrayOf(
                Manifest.permission.BLUETOOTH_SCAN,
                Manifest.permission.BLUETOOTH_CONNECT,
            )
        } else {
            arrayOf(Manifest.permission.ACCESS_FINE_LOCATION)
        }
        permissionLauncher.launch(perms)
    }

    private fun connectDevice(device: BleDevice) {
        bleManager.stopScan()
        LogCollector.log("BLE", "Connecting ${device.name} addr=${device.address}...")
        try {
            bleManager.connect(this, device) { connected ->
                runOnUiThread {
                    bleManager.connected.value = connected
                    if (!connected) bleManager.connectionError.value = true
                    LogCollector.log("BLE", if (connected) "Connected OK" else "Connection failed")
                }
            }
        } catch (e: Exception) {
            LogCollector.log("BLE", "connectDevice error: ${e.message}")
            Log.e("BMS_BLE", "connectDevice crash", e)
        }
    }

    private fun disconnect() {
        LogCollector.log("BLE", "Disconnecting...")
        bleManager.disconnect()
    }

    override fun onDestroy() {
        super.onDestroy()
        bleManager.stopScan()
        bleManager.disconnect()
    }

    override fun onResume() {
        super.onResume()
        val status = if (bleManager.connected.value) "connected" else "disconnected"
        LogCollector.log("BLE", "onResume: BLE status=$status")
        mainWebView?.let { wv ->
            wv.post {
                val js = "try{if(window.__APP_BRIDGE__&&window.__APP_BRIDGE__._handler){window.__APP_BRIDGE__._handler({type:'bms:connection-status',payload:{\"status\":\"$status\"}})}}catch(e){console.log('BRIDGE:push_error:'+e.message)}"
                wv.evaluateJavascript(js, null)
            }
        }
    }
}

data class BleDevice(
    val name: String,
    val address: String,
    val rssi: Int,
    val soc: Int = 0,
    val voltage: Int = 0,
    val current: Int = 0,
    val safety: Int = 0,
    val lastSeen: Long = System.currentTimeMillis(),
) {
    fun voltageV(): Float = voltage / 100f
    fun currentA(): Float = current / 10f
}

object SafetyBits {
    const val CUV = 0; const val OCD = 1; const val SCD = 2; const val DSG_OT = 3
    const val RCA = 4; const val DSG_UT = 5; const val COV = 8; const val OCC = 9
    const val CHG_OT = 10; const val CHG_UT = 11; const val MOS_OT = 12
    const val COM_OUT = 13; const val P_DSG = 14; const val ALERT = 15

    private val NAMES = mapOf(
        CUV to "CUV", OCD to "OCD", SCD to "SCD", DSG_OT to "DSG_OT",
        RCA to "RCA", DSG_UT to "DSG_UT", COV to "COV", OCC to "OCC",
        CHG_OT to "CHG_OT", CHG_UT to "CHG_UT", MOS_OT to "MOS_OT",
        COM_OUT to "COM_OUT", P_DSG to "P_DSG", ALERT to "ALERT",
    )

    fun activeFlags(safety: Int): List<String> {
        val flags = mutableListOf<String>()
        for (i in 0..15) {
            if ((safety shr i) and 1 == 1) {
                NAMES[i]?.let { flags.add(it) }
            }
        }
        return flags
    }
}

@Suppress("DEPRECATION")
fun getScanRecordBytes(record: android.bluetooth.le.ScanRecord): ByteArray? = record.getBytes()

fun parseMfgData(data: ByteArray): IntArray? {
    Log.d("BMS_BLE", "parseMfgData: ${data.size} bytes: ${data.joinToString("") { "%02x".format(it) }}")
    // 格式1: 9+ bytes (旧格式, 前2字节为前缀)
    if (data.size >= 9) {
        val soc = data[2].toInt() and 0xFF
        val voltage = ((data[4].toInt() and 0xFF) shl 8) or (data[3].toInt() and 0xFF)
        val current = ((data[6].toInt() and 0xFF) shl 8) or (data[5].toInt() and 0xFF)
        val safety = ((data[8].toInt() and 0xFF) shl 8) or (data[7].toInt() and 0xFF)
        Log.d("BMS_BLE", "parseMfgData(fmt1 9B): soc=$soc V=$voltage I=$current safety=0x${safety.toString(16)}")
        return intArrayOf(soc, voltage, current, safety)
    }
    // 格式2: 7 bytes (新格式, 无前缀)
    if (data.size >= 7) {
        val soc = data[0].toInt() and 0xFF
        val voltage = ((data[2].toInt() and 0xFF) shl 8) or (data[1].toInt() and 0xFF)
        val current = ((data[4].toInt() and 0xFF) shl 8) or (data[3].toInt() and 0xFF)
        val safety = ((data[6].toInt() and 0xFF) shl 8) or (data[5].toInt() and 0xFF)
        Log.d("BMS_BLE", "parseMfgData(fmt2 7B): soc=$soc V=$voltage I=$current safety=0x${safety.toString(16)}")
        return intArrayOf(soc, voltage, current, safety)
    }
    Log.d("BMS_BLE", "parseMfgData: data too short (${data.size} bytes)")
    return null
}

fun parseAdData(bytes: ByteArray): IntArray? {
    var i = 0
    while (i < bytes.size - 3) {
        val len = bytes[i].toInt() and 0xFF
        if (len == 0 || i + len >= bytes.size) break
        val type = bytes[i + 1].toInt() and 0xFF
        if (type == 0xFF && len >= 12) {
            val mfgId = ((bytes[i + 3].toInt() and 0xFF) shl 8) or (bytes[i + 2].toInt() and 0xFF)
            if (mfgId == 0xFF0A) {
                val off = i + 4
                val soc = bytes[off + 2].toInt() and 0xFF
                val voltage = ((bytes[off + 4].toInt() and 0xFF) shl 8) or (bytes[off + 3].toInt() and 0xFF)
                val current = ((bytes[off + 6].toInt() and 0xFF) shl 8) or (bytes[off + 5].toInt() and 0xFF)
                val safety = ((bytes[off + 8].toInt() and 0xFF) shl 8) or (bytes[off + 7].toInt() and 0xFF)
                return intArrayOf(soc, voltage, current, safety)
            }
        }
        i += len + 1
    }
    return null
}

class BleManager {
    val devices = mutableStateListOf<BleDevice>()
    val scanning = mutableStateOf(false)
    val connected = mutableStateOf(false)
    val connectedDevice = mutableStateOf<BleDevice?>(null)
    val connectionError = mutableStateOf(false)
    val rememberedAddresses = mutableStateListOf<String>()
    val scanStatus = mutableStateOf("")

    private var bluetoothAdapter: BluetoothAdapter? = null
    private var bleConnection: BleConnection? = null
    private var pendingDataCallback: ((ByteArray) -> Unit)? = null

    companion object {
        const val SERVICE_UUID = "0000ff00-0000-1000-8000-00805f9b34fb"
        const val NOTIFY_UUID = "0000ff01-0000-1000-8000-00805f9b34fb"
        const val WRITE_UUID = "0000ff02-0000-1000-8000-00805f9b34fb"
        const val NAME_PREFIX = "DCSF"
        const val MAX_DEVICES = 30
    }

    fun rememberDevice(address: String) {
        if (!rememberedAddresses.contains(address)) {
            rememberedAddresses.add(address)
        }
    }

    fun forgetDevice(address: String) {
        rememberedAddresses.remove(address)
    }

    fun isRemembered(address: String): Boolean = rememberedAddresses.contains(address)

    private val scanCallback = object : ScanCallback() {
        override fun onScanResult(callbackType: Int, result: ScanResult) {
            val name = result.device.name ?: return
            if (!name.startsWith(NAME_PREFIX)) return
            LogCollector.log("BLE", "Found $name RSSI=${result.rssi}")

            var soc = 0; var voltage = 0; var current = 0; var safety = 0
            val scanRecord = result.scanRecord
            if (scanRecord != null) {
                // 方法1: 使用 getManufacturerSpecificData API (API 21+, 更可靠)
                val mfgDataMap = scanRecord.manufacturerSpecificData
                if (mfgDataMap != null && mfgDataMap.size() > 0) {
                    for (i in 0 until mfgDataMap.size()) {
                        val mfgId = mfgDataMap.keyAt(i)
                        val mfgData = mfgDataMap.valueAt(i)
                        val hexStr = mfgData.joinToString("") { "%02x".format(it) }
                        Log.d("BMS_BLE", "MfgData id=0x${mfgId.toString(16)} len=${mfgData.size} data=$hexStr")
                        LogCollector.log("BLE", "Mfg 0x${mfgId.toString(16)}: $hexStr")

                        val parsed = parseMfgData(mfgData)
                        if (parsed != null) {
                            soc = parsed[0]; voltage = parsed[1]; current = parsed[2]; safety = parsed[3]
                            LogCollector.log("BLE", "Adv: soc=$soc V=$voltage I=$current safety=0x${safety.toString(16)}")
                            break
                        }
                    }
                }

                // 方法2: 如果API方法失败，尝试原始字节解析
                if (soc == 0 && voltage == 0) {
                    val bytes = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) scanRecord.bytes else getScanRecordBytes(scanRecord)
                    if (bytes != null) {
                        Log.d("BMS_BLE", "Raw bytes for $name: ${bytes.joinToString("") { "%02x".format(it) }}")
                        val parsed = parseAdData(bytes)
                        if (parsed != null) {
                            soc = parsed[0]; voltage = parsed[1]; current = parsed[2]; safety = parsed[3]
                            Log.d("BMS_BLE", "Parsed via raw: soc=$soc V=$voltage I=$current safety=$safety")
                            LogCollector.log("BLE", "Adv(raw): soc=$soc V=$voltage I=$current")
                        } else {
                            Log.d("BMS_BLE", "parseAdData returned null")
                            LogCollector.log("BLE", "Adv parse failed (raw)")
                        }
                    } else {
                        LogCollector.log("BLE", "No scan record bytes")
                    }
                }
            } else {
                LogCollector.log("BLE", "No scan record")
            }

            val existing = devices.indexOfFirst { it.address == result.device.address }
            val device = BleDevice(name, result.device.address, result.rssi, soc, voltage, current, safety, System.currentTimeMillis())

            if (existing >= 0) {
                devices[existing] = device
            } else if (devices.size < MAX_DEVICES) {
                devices.add(device)
            }
        }

        override fun onScanFailed(errorCode: Int) {
            scanning.value = false
            scanStatus.value = "Scan failed: $errorCode"
            LogCollector.log("BLE", "Scan failed: $errorCode")
        }
    }

    fun startScan(context: Context) {
        val bm = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
        bluetoothAdapter = bm?.adapter

        if (bluetoothAdapter == null) {
            scanStatus.value = "No Bluetooth adapter"
            scanning.value = false
            return
        }
        if (bluetoothAdapter?.isEnabled != true) {
            scanStatus.value = "Bluetooth is off"
            scanning.value = false
            return
        }

        val hasPerm = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            ContextCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_SCAN) == PackageManager.PERMISSION_GRANTED
        } else {
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        }
        if (!hasPerm) {
            scanStatus.value = "No BLE permission"
            scanning.value = false
            return
        }

        val scanner = bluetoothAdapter?.bluetoothLeScanner
        if (scanner == null) {
            scanStatus.value = "No BLE scanner"
            scanning.value = false
            return
        }

        devices.clear()
        scanning.value = true
        scanStatus.value = "Scanning..."
        // Don't use ScanFilter.setDeviceName - it does exact match, not prefix match.
        // We filter by name prefix in the scan callback instead.
        val settings = android.bluetooth.le.ScanSettings.Builder()
            .setScanMode(android.bluetooth.le.ScanSettings.SCAN_MODE_LOW_LATENCY)
            .build()
        try {
            scanner.startScan(emptyList(), settings, scanCallback)
        } catch (e: SecurityException) {
            scanStatus.value = "SecurityException: ${e.message}"
            scanning.value = false
        }
    }

    fun cleanupStaleDevices(maxAgeMs: Long = 5000L) {
        val now = System.currentTimeMillis()
        val toRemove = devices.filter { now - it.lastSeen > maxAgeMs }
        if (toRemove.isNotEmpty()) {
            devices.removeAll(toRemove)
        }
    }

    fun stopScan() {
        scanning.value = false
        bluetoothAdapter?.bluetoothLeScanner?.stopScan(scanCallback)
    }

    fun connect(context: Context, device: BleDevice, onResult: (Boolean) -> Unit) {
        stopScan()
        val adapter = bluetoothAdapter ?: return onResult(false)
        val btDevice = adapter.getRemoteDevice(device.address) ?: return onResult(false)

        bleConnection?.disconnect()
        bleConnection = null

        bleConnection = BleConnection(btDevice, SERVICE_UUID, NOTIFY_UUID, WRITE_UUID)
        pendingDataCallback?.let { bleConnection?.onDataReceived = it }
        bleConnection?.onDisconnected = {
            connected.value = false
            connectedDevice.value = null
        }
        bleConnection?.connect(context) { success ->
            if (success) {
                connectedDevice.value = device
                connectionError.value = false
            }
            onResult(success)
        }
    }

    fun disconnect() {
        bleConnection?.disconnect()
        bleConnection = null
        connected.value = false
        connectedDevice.value = null
    }

    fun send(data: ByteArray): Boolean {
        if (!connected.value) return false
        return bleConnection?.write(data) ?: false
    }

    fun setOnDataReceived(callback: (ByteArray) -> Unit) {
        pendingDataCallback = callback
        bleConnection?.onDataReceived = callback
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BmsApp(
    bleManager: BleManager,
    colors: AppColors,
    darkTheme: Boolean,
    onRequestPermissions: () -> Unit,
    onConnectDevice: (BleDevice) -> Unit,
    onDisconnect: () -> Unit,
    onWebViewCreated: (WebView) -> Unit = {},
) {
    var selectedTab by rememberSaveable { mutableIntStateOf(0) }
    var sidebarVisible by rememberSaveable { mutableStateOf(true) }
    val webView = remember { mutableStateOf<WebView?>(null) }
    val uiReady = remember { mutableStateOf(false) }
    val configuration = LocalConfiguration.current
    val isWideScreen = configuration.screenWidthDp >= 600
    val themeStr = if (darkTheme) "dark" else "light"

    // File chooser state for import functionality
    val fileChooserCallback = remember { mutableStateOf<ValueCallback<Array<Uri>>?>(null) }
    val context = LocalContext.current
    val fileChooserLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val callback = fileChooserCallback.value
        if (callback != null) {
            if (result.resultCode == android.app.Activity.RESULT_OK && result.data != null) {
                val uri = result.data!!.data
                if (uri != null) {
                    // Grant read permission for the URI
                    try {
                        context.contentResolver.takePersistableUriPermission(uri, android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    } catch (_e: SecurityException) { /* ignore */ }
                    callback.onReceiveValue(arrayOf(uri))
                    LogCollector.log("UI", "File selected: $uri")
                } else {
                    callback.onReceiveValue(null)
                }
            } else {
                callback.onReceiveValue(null)
            }
            fileChooserCallback.value = null
        }
    }

    LaunchedEffect(bleManager.connected.value) {
        val status = if (bleManager.connected.value) "connected" else "disconnected"
        pushToUi(webView, "bms:connection-status", """{"status":"$status"}""")
        LogCollector.log("BLE", "connection: $status")
        if (bleManager.connected.value) {
            selectedTab = 1
        }
    }

    LaunchedEffect(darkTheme) {
        pushToUi(webView, "bms:theme-change", """{"theme":"$themeStr"}""")
        LogCollector.log("UI", "theme sync: $themeStr")
    }

    LaunchedEffect(Unit) {
        bleManager.setOnDataReceived { data ->
            if (!uiReady.value) return@setOnDataReceived
            val hexStr = data.joinToString("") { "%02x".format(it) }
            pushToUi(webView, "bms:raw-data", """{"data":"$hexStr"}""")
        }
    }

    val createWebView: (Context) -> WebView = { ctx ->
        WebView(ctx).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = true
            settings.databaseEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            settings.mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW
            settings.useWideViewPort = true
            settings.loadWithOverviewMode = true
            // Set background color to match UI theme, preventing white flash
            val bgHex = if (darkTheme) "#060709" else "#F3F5F9"
            setBackgroundColor(android.graphics.Color.parseColor(bgHex))
            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView?, url: String?) {
                    Log.d("BMS_UI", "Page finished: $url")
                    LogCollector.log("UI", "Page loaded: $url")
                    super.onPageFinished(view, url)
                    uiReady.value = true
                    view?.evaluateJavascript("localStorage.setItem('bms-theme','$themeStr')", null)

                    val shim = """
                        window.__APP_BRIDGE__ = {
                            _handler: null,
                            onMessage: function(cb) { window.__APP_BRIDGE__._handler = cb; },
                            postMessage: function(msg) {
                                if(window.__NativeBridge__ && window.__NativeBridge__.postMessage) {
                                    window.__NativeBridge__.postMessage(JSON.stringify(msg));
                                }
                            },
                            sendFrame: function(json) {
                                if(window.__NativeBridge__ && window.__NativeBridge__.sendFrame) {
                                    window.__NativeBridge__.sendFrame(json);
                                }
                            },
                            getPlatform: function() {
                                if(window.__NativeBridge__ && window.__NativeBridge__.getPlatform) {
                                    return window.__NativeBridge__.getPlatform();
                                }
                            }
                        };
                    """
                    view?.evaluateJavascript(shim, null)
                }
                override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
                    super.onPageStarted(view, url, favicon)
                    // Set background immediately to prevent white flash
                    val bg = if (darkTheme) "#060709" else "#F3F5F9"
                    view?.setBackgroundColor(android.graphics.Color.parseColor(bg))
                }
            }
            webChromeClient = object : WebChromeClient() {
                override fun onConsoleMessage(consoleMessage: android.webkit.ConsoleMessage): Boolean {
                    Log.d("BMS_JS", "${consoleMessage.message()} -- ${consoleMessage.sourceId()}:${consoleMessage.lineNumber()}")
                    LogCollector.log("JS", consoleMessage.message().take(80))
                    return true
                }
                override fun onShowFileChooser(webView: WebView?, filePathCallback: ValueCallback<Array<Uri>>?, fileChooserParams: FileChooserParams?): Boolean {
                    fileChooserCallback.value?.onReceiveValue(null)
                    fileChooserCallback.value = filePathCallback
                    val intent = android.content.Intent(android.content.Intent.ACTION_GET_CONTENT)
                    intent.addCategory(android.content.Intent.CATEGORY_OPENABLE)
                    intent.type = "*/*"
                    intent.putExtra(android.content.Intent.EXTRA_MIME_TYPES, arrayOf("application/json", "text/csv", "*/*"))
                    try {
                        fileChooserLauncher.launch(intent)
                    } catch (e: Exception) {
                        LogCollector.log("UI", "File chooser error: ${e.message}")
                        filePathCallback?.onReceiveValue(null)
                    }
                    return true
                }
            }
            addJavascriptInterface(object {
                @android.webkit.JavascriptInterface
                fun postMessage(json: String) {
                    try {
                        val msg = org.json.JSONObject(json)
                        val type = msg.optString("type", "")
                        val payload = msg.optJSONObject("payload")
                        LogCollector.log("JS", "msg $type")
                        when (type) {
                            "bms:frame-send" -> {
                                if (!bleManager.connected.value) {
                                    pushToUi(webView, "bms:connection-status", """{"status":"disconnected"}""")
                                    return@postMessage
                                }
                                val frameVal = payload?.opt("frame")
                                LogCollector.log("JS", "frame-send frameVal type=${frameVal?.javaClass?.simpleName} val=${frameVal.toString().take(40)}")
                                val frame: ByteArray? = when (frameVal) {
                                    is org.json.JSONArray -> {
                                        ByteArray(frameVal.length()) { frameVal.getInt(it).toByte() }
                                    }
                                    is String -> {
                                        if (frameVal.length % 2 != 0) null
                                        else ByteArray(frameVal.length / 2) { frameVal.substring(it * 2, it * 2 + 2).toInt(16).toByte() }
                                    }
                                    else -> null
                                }
                                if (frame != null) {
                                    bleManager.send(frame)
                                    LogCollector.log("UI", "TX ${frame.size}B: ${frame.joinToString("") { "%02x".format(it) }}")
                                } else {
                                    LogCollector.log("JS", "frame-send: frame is null or invalid")
                                }
                            }
                            "bms:request-status" -> {
                                val status = if (bleManager.connected.value) "connected" else "disconnected"
                                pushToUi(webView, "bms:connection-status", """{"status":"$status"}""")
                                pushToUi(webView, "bms:theme-change", """{"theme":"$themeStr"}""")
                                LogCollector.log("UI", "request-status: theme=$themeStr status=$status")
                            }
                            "bms:ui-ready" -> {
                                val status = if (bleManager.connected.value) "connected" else "disconnected"
                                pushToUi(webView, "bms:connection-status", """{"status":"$status"}""")
                                pushToUi(webView, "bms:theme-change", """{"theme":"$themeStr"}""")
                                LogCollector.log("UI", "ui-ready: theme=$themeStr status=$status")
                            }
                            "bms:download-file" -> {
                                val filename = payload?.optString("filename", "download.bin") ?: "download.bin"
                                val content = payload?.optString("content", "") ?: ""
                                val mimeType = payload?.optString("mimeType", "application/octet-stream") ?: "application/octet-stream"
                                try {
                                    val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                                    val file = File(downloadsDir, filename)
                                    FileOutputStream(file).use { it.write(content.toByteArray(Charsets.UTF_8)) }
                                    LogCollector.log("UI", "File saved: ${file.absolutePath}")
                                    pushToUi(webView, "bms:file-saved", """{"path":"${file.absolutePath}","filename":"$filename"}""")
                                } catch (e: Exception) {
                                    LogCollector.log("UI", "File save error: ${e.message}")
                                    pushToUi(webView, "bms:file-save-error", """{"error":"${e.message?.replace("\"", "\\\"")}"}""")
                                }
                            }
                        }
                    } catch (_e: Exception) {
                        LogCollector.log("JS", "postMessage error: ${_e.message}")
                    }
                }

                @android.webkit.JavascriptInterface
                fun sendFrame(json: String) {
                    if (!bleManager.connected.value) return
                    val nums = json.trim('[', ']').split(',').mapNotNull { it.trim().toIntOrNull() }
                    val frame = ByteArray(nums.size) { nums[it].toByte() }
                    bleManager.send(frame)
                }

                @android.webkit.JavascriptInterface
                fun getPlatform(): String {
                    return """{"platform":"app","version":"1.0.0","bluetoothSupported":true,"serialSupported":false}"""
                }

                @android.webkit.JavascriptInterface
                fun saveFile(filename: String, content: String): String {
                    try {
                        val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                        val file = File(downloadsDir, filename)
                        FileOutputStream(file).use { it.write(content.toByteArray(Charsets.UTF_8)) }
                        LogCollector.log("UI", "File saved: ${file.absolutePath}")
                        return file.absolutePath
                    } catch (e: Exception) {
                        LogCollector.log("UI", "File save error: ${e.message}")
                        return ""
                    }
                }
            }, "__NativeBridge__")
            loadUrl("https://ui.bms.pub")
            webView.value = this
            onWebViewCreated(this)
        }
    }



    Box(modifier = Modifier.fillMaxSize()) {
    if (isWideScreen) {
        Row(
            modifier = Modifier
                .fillMaxSize()
                .background(colors.bg)
        ) {
            if (sidebarVisible) {
                Box(
                    modifier = Modifier
                        .width(360.dp)
                        .fillMaxHeight()
                ) {
                    BluetoothPage(
                        bleManager = bleManager,
                        colors = colors,
                        onRequestPermissions = onRequestPermissions,
                        onConnectDevice = onConnectDevice,
                        onDisconnect = onDisconnect,
                        onConnectedClick = { selectedTab = 1 },
                        modifier = Modifier.fillMaxSize(),
                    )
                }
                Box(
                    modifier = Modifier
                        .width(1.dp)
                        .fillMaxHeight()
                        .background(colors.border)
                )
            }
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxHeight()
            ) {
                AndroidView(
                    factory = createWebView,
                    modifier = Modifier.fillMaxSize(),
                )
                if (!bleManager.connected.value) {
                    Box(
                        modifier = Modifier.fillMaxSize().background(colors.bg),
                        contentAlignment = Alignment.Center,
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(Icons.Default.BluetoothDisabled, contentDescription = null, modifier = Modifier.size(48.dp), tint = colors.fg3)
                            Spacer(Modifier.height(8.dp))
                            Text("请先连接蓝牙设备", color = colors.fg3, fontSize = 14.sp)
                        }
                    }
                }
            }
        }
        Card(
            shape = RoundedCornerShape(topEnd = 8.dp, bottomEnd = 8.dp),
            colors = CardDefaults.cardColors(containerColor = colors.surface),
            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
            modifier = Modifier
                .align(Alignment.CenterStart)
                .size(width = 24.dp, height = 48.dp)
                .clickable { sidebarVisible = !sidebarVisible },
        ) {
            Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxSize()) {
                Icon(
                    if (sidebarVisible) Icons.Default.ChevronLeft else Icons.Default.ChevronRight,
                    contentDescription = if (sidebarVisible) "隐藏侧栏" else "显示侧栏",
                    tint = colors.fg2,
                    modifier = Modifier.size(16.dp),
                )
            }
        }
    } else {
        val showBottomBar = !(bleManager.connected.value && selectedTab == 1)
        Scaffold(
            containerColor = colors.bg,
            bottomBar = {
                if (showBottomBar) {
                    NavigationBar(
                        containerColor = colors.navBg,
                        tonalElevation = 2.dp,
                    ) {
                        NavigationBarItem(
                            selected = selectedTab == 0,
                            onClick = { selectedTab = 0 },
                            icon = {
                                Icon(
                                    if (bleManager.connected.value) Icons.Default.BluetoothConnected
                                    else Icons.Default.Bluetooth,
                                    contentDescription = null,
                                    tint = if (selectedTab == 0) colors.primary else colors.fg2
                                )
                            },
                            label = {
                                Text(
                                    if (bleManager.connected.value) "已连接" else "蓝牙",
                                    color = if (selectedTab == 0) colors.primary else colors.fg2,
                                    fontSize = 12.sp
                                )
                            },
                        )
                        NavigationBarItem(
                            selected = false,
                            onClick = { },
                            icon = {
                                Box(
                                    modifier = Modifier
                                        .size(40.dp)
                                        .background(colors.primary, RoundedCornerShape(20.dp)),
                                    contentAlignment = Alignment.Center,
                                ) {
                                    Icon(
                                        Icons.Default.QrCodeScanner,
                                        contentDescription = "扫码",
                                        tint = colors.primaryFg,
                                        modifier = Modifier.size(22.dp),
                                    )
                                }
                            },
                            label = {
                                Text(
                                    "扫码",
                                    color = colors.fg2,
                                    fontSize = 12.sp
                                )
                            },
                        )
                        NavigationBarItem(
                            selected = selectedTab == 1,
                            onClick = { if (bleManager.connected.value) selectedTab = 1 },
                            icon = {
                                Icon(
                                    Icons.Default.BluetoothDisabled,
                                    contentDescription = null,
                                    tint = if (selectedTab == 1) colors.primary else colors.fg2
                                )
                            },
                            label = {
                                Text(
                                    "控制台",
                                    color = if (selectedTab == 1) colors.primary else colors.fg2,
                                    fontSize = 12.sp
                                )
                            },
                        )
                    }
                }
            }
        ) { padding ->
            Box(modifier = Modifier.fillMaxSize()) {
                // Always render WebView page when connected (prevents recreation on tab switch)
                if (bleManager.connected.value) {
                    Column(modifier = Modifier.fillMaxSize().padding(if (showBottomBar) padding else PaddingValues())) {
                        if (!showBottomBar) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(40.dp)
                                    .background(colors.bg.copy(alpha = 0.85f))
                                    .clickable { selectedTab = 0 }
                                    .padding(horizontal = 12.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Icon(
                                    Icons.Default.BluetoothConnected,
                                    contentDescription = null,
                                    tint = colors.primary,
                                    modifier = Modifier.size(16.dp),
                                )
                                Spacer(Modifier.width(6.dp))
                                Text(
                                    bleManager.connectedDevice.value?.name ?: "BMS",
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Medium,
                                    color = colors.fg,
                                )
                            }
                        }
                        UiPage(
                            bleManager = bleManager,
                            colors = colors,
                            webView = webView,
                            darkTheme = darkTheme,
                            modifier = Modifier.fillMaxSize().weight(1f),
                            createWebView = createWebView,
                            pushToUi = { type, payload -> pushToUi(webView, type, payload) },
                        )
                    }
                }
                // Overlay BluetoothPage on top when selectedTab == 0
                if (selectedTab == 0 || !bleManager.connected.value) {
                    BluetoothPage(
                        bleManager = bleManager,
                        colors = colors,
                        onRequestPermissions = onRequestPermissions,
                        onConnectDevice = onConnectDevice,
                        onDisconnect = onDisconnect,
                        onConnectedClick = { selectedTab = 1 },
                        modifier = Modifier.padding(padding).fillMaxSize(),
                    )
                }
            }
        }
    }

    // Floating debug panel
    var showDebug by remember { mutableStateOf(false) }
    if (showDebug) {
        val logListState = rememberLazyListState()
        val logsList = LogCollector.logs
        LaunchedEffect(logsList.size) {
            if (logsList.isNotEmpty()) {
                logListState.animateScrollToItem(logsList.lastIndex)
            }
        }
        Card(
            shape = RoundedCornerShape(8.dp),
            colors = CardDefaults.cardColors(containerColor = colors.surface),
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(8.dp)
                .fillMaxWidth(0.92f)
                .heightIn(max = 350.dp),
            elevation = CardDefaults.cardElevation(defaultElevation = 6.dp),
        ) {
            Column {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(Icons.Default.Terminal, contentDescription = null, tint = colors.fg2, modifier = Modifier.size(14.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("调试日志 (${logsList.size})", fontSize = 12.sp, color = colors.fg2, fontWeight = FontWeight.Medium, modifier = Modifier.weight(1f))
                    TextButton(onClick = { LogCollector.clear() }) { Text("清除", fontSize = 11.sp, color = colors.danger) }
                    IconButton(onClick = { showDebug = false }, modifier = Modifier.size(24.dp)) {
                        Text("✕", fontSize = 14.sp, color = colors.fg2)
                    }
                }
                if (logsList.isEmpty()) {
                    Box(modifier = Modifier.fillMaxWidth().padding(16.dp), contentAlignment = Alignment.Center) {
                        Text("暂无日志", fontSize = 12.sp, color = colors.fg3)
                    }
                } else {
                    LazyColumn(
                        state = logListState,
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp).padding(bottom = 8.dp),
                        verticalArrangement = Arrangement.spacedBy(2.dp),
                    ) {
                        items(logsList.toList()) { log ->
                            val tagColor = when {
                                log.contains(" BLE ") -> Color(0xFF60A5FA)
                                log.contains(" JS ") -> Color(0xFFA78BFA)
                                log.contains(" UI ") -> Color(0xFF34D399)
                                else -> colors.fg3
                            }
                            Text(log, fontSize = 10.sp, fontFamily = FontFamily.Monospace, color = tagColor, lineHeight = 14.sp)
                        }
                    }
                }
            }
        }
    } else {
        Card(
            shape = RoundedCornerShape(8.dp),
            colors = CardDefaults.cardColors(containerColor = colors.surface),
            elevation = CardDefaults.cardElevation(defaultElevation = 4.dp),
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(12.dp)
                .size(40.dp)
                .clickable { showDebug = true },
        ) {
            Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxSize()) {
                Icon(Icons.Default.Terminal, contentDescription = "调试", tint = colors.fg2, modifier = Modifier.size(18.dp))
            }
        }
    }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BluetoothPage(
    bleManager: BleManager,
    colors: AppColors,
    onRequestPermissions: () -> Unit,
    onConnectDevice: (BleDevice) -> Unit,
    onDisconnect: () -> Unit,
    onConnectedClick: () -> Unit = {},
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val listState = rememberLazyListState()

    // Auto-scan whenever BluetoothPage is visible
    LaunchedEffect(Unit) {
        if (!bleManager.scanning.value && !bleManager.connected.value) {
            if (hasBlePermissions(context)) {
                bleManager.startScan(context)
            } else {
                onRequestPermissions()
            }
        }
    }

    // Periodic cleanup of stale devices (>5 seconds not seen)
    LaunchedEffect(Unit) {
        while (true) {
            kotlinx.coroutines.delay(2000L)
            bleManager.cleanupStaleDevices(5000L)
        }
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(colors.bg)
            .padding(16.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                "附近设备",
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
                color = colors.fg,
            )
            if (bleManager.scanning.value) {
                CircularProgressIndicator(
                    modifier = Modifier.size(16.dp),
                    strokeWidth = 2.dp,
                    color = colors.primary,
                )
            }
        }

        if (bleManager.devices.isEmpty() && !bleManager.scanning.value) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center,
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(
                        Icons.Default.BluetoothDisabled,
                        contentDescription = null,
                        modifier = Modifier.size(48.dp),
                        tint = colors.fg3,
                    )
                    Spacer(Modifier.height(8.dp))
                    Text("未发现设备", color = colors.fg3, fontSize = 14.sp)
                    Spacer(Modifier.height(16.dp))
                    Button(
                        onClick = {
                            if (hasBlePermissions(context)) bleManager.startScan(context) else onRequestPermissions()
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = colors.primary),
                        shape = RoundedCornerShape(8.dp),
                    ) {
                        Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(6.dp))
                        Text("开始扫描")
                    }
                }
            }
        } else {
            val connAddr = bleManager.connectedDevice.value?.address
            val remembered = bleManager.devices.filter { bleManager.isRemembered(it.address) }
                .sortedByDescending { it.address == connAddr }
            val newDevs = bleManager.devices.filter { !bleManager.isRemembered(it.address) }
                .sortedByDescending { it.address == connAddr }

            LazyColumn(
                state = listState,
                modifier = Modifier
                    .fillMaxSize(),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                if (remembered.isNotEmpty()) {
                    item {
                        Text(
                            "记忆设备",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium,
                            color = colors.fg2,
                            modifier = Modifier.padding(top = 8.dp, bottom = 4.dp),
                        )
                    }
                    items(remembered, key = { it.address }) { device ->
                        val isConn = connAddr != null && device.address == connAddr
                        SwipeDeviceCard(
                            device = device,
                            isConn = isConn,
                            isRemembered = true,
                            colors = colors,
                            onClick = { onConnectDevice(device) },
                            onForget = { bleManager.forgetDevice(device.address) },
                            onSaveRemember = { bleManager.rememberDevice(device.address) },
                            onDisconnect = onDisconnect,
                            onConnectedClick = onConnectedClick,
                        )
                    }
                }
                if (newDevs.isNotEmpty()) {
                    item {
                        Text(
                            "新设备",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium,
                            color = colors.fg2,
                            modifier = Modifier.padding(top = 12.dp, bottom = 4.dp),
                        )
                    }
                    items(newDevs, key = { it.address }) { device ->
                        val isConn = connAddr != null && device.address == connAddr
                        SwipeDeviceCard(
                            device = device,
                            isConn = isConn,
                            isRemembered = false,
                            colors = colors,
                            onClick = { onConnectDevice(device) },
                            onForget = { bleManager.forgetDevice(device.address) },
                            onSaveRemember = { bleManager.rememberDevice(device.address) },
                            onDisconnect = onDisconnect,
                            onConnectedClick = onConnectedClick,
                        )
                    }
                }
            }
        }

        DebugLogPanel(colors)
    }
}

@Composable
fun DebugLogPanel(colors: AppColors) {
    var expanded by remember { mutableStateOf(false) }
    val logs = LogCollector.logs
    val logListState = rememberLazyListState()
    // Auto-scroll to bottom when new logs arrive
    LaunchedEffect(logs.size) {
        if (logs.isNotEmpty()) {
            logListState.animateScrollToItem(logs.lastIndex)
        }
    }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 8.dp),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable { expanded = !expanded }
                .padding(vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                Icons.Default.Terminal,
                contentDescription = null,
                tint = colors.fg2,
                modifier = Modifier.size(16.dp),
            )
            Spacer(Modifier.width(6.dp))
            Text(
                if (expanded) "调试日志 (${logs.size}) ▼" else "调试日志 ▶",
                fontSize = 12.sp,
                color = colors.fg2,
                fontWeight = FontWeight.Medium,
            )
            Spacer(Modifier.weight(1f))
            if (expanded && logs.isNotEmpty()) {
                TextButton(onClick = { LogCollector.clear() }) {
                    Text("清除", fontSize = 11.sp, color = colors.danger)
                }
            }
        }

        if (expanded) {
            Card(
                shape = RoundedCornerShape(8.dp),
                colors = CardDefaults.cardColors(containerColor = colors.surface),
                modifier = Modifier.fillMaxWidth().heightIn(max = 300.dp),
            ) {
                if (logs.isEmpty()) {
                    Box(
                        modifier = Modifier.fillMaxWidth().padding(16.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text("暂无日志", fontSize = 12.sp, color = colors.fg3)
                    }
                } else {
                    LazyColumn(
                        state = logListState,
                        modifier = Modifier.fillMaxWidth().padding(8.dp),
                        verticalArrangement = Arrangement.spacedBy(2.dp),
                    ) {
                        items(logs.toList()) { log ->
                            val tagColor = when {
                                log.contains(" BLE ") -> Color(0xFF60A5FA)
                                log.contains(" JS ") -> Color(0xFFA78BFA)
                                log.contains(" UI ") -> Color(0xFF34D399)
                                else -> colors.fg3
                            }
                            Text(
                                log,
                                fontSize = 10.sp,
                                fontFamily = FontFamily.Monospace,
                                color = tagColor,
                                lineHeight = 14.sp,
                            )
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SwipeDeviceCard(
    device: BleDevice,
    isConn: Boolean,
    isRemembered: Boolean,
    colors: AppColors,
    onClick: () -> Unit,
    onForget: () -> Unit,
    onSaveRemember: () -> Unit,
    onDisconnect: () -> Unit,
    onConnectedClick: () -> Unit = {},
) {
    val dismissState = rememberSwipeToDismissBoxState()
    val showSwipe = (isConn && !isRemembered) || (!isConn && isRemembered)

    if (showSwipe) {
        SwipeToDismissBox(
            state = dismissState,
            backgroundContent = {
                val isSave = isConn && !isRemembered
                val bgColor by animateColorAsState(
                    when (dismissState.targetValue) {
                        SwipeToDismissBoxValue.EndToStart -> if (isSave) colors.primary else colors.swipeBg
                        else -> Color.Transparent
                    }, label = "swipe-bg"
                )
                val fgColor by animateColorAsState(
                    when (dismissState.targetValue) {
                        SwipeToDismissBoxValue.EndToStart -> if (isSave) colors.primaryFg else Color.White
                        else -> Color.Transparent
                    }, label = "swipe-fg"
                )
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(bgColor, RoundedCornerShape(12.dp))
                        .padding(end = 20.dp),
                    contentAlignment = Alignment.CenterEnd,
                ) {
                    Text(
                        if (isSave) "保存记忆" else "取消记忆",
                        color = fgColor,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 14.sp,
                    )
                }
            },
            enableDismissFromStartToEnd = false,
        ) {
            if (isConn) {
                ConnectedCard(device = device, colors = colors, onDisconnect = onDisconnect, onClick = onConnectedClick)
            } else {
                DeviceCard(device = device, colors = colors, onClick = onClick)
            }
        }

        LaunchedEffect(dismissState.currentValue) {
            if (dismissState.currentValue == SwipeToDismissBoxValue.EndToStart) {
                if (isConn && !isRemembered) onSaveRemember() else onForget()
                dismissState.reset()
            }
        }
    } else {
        if (isConn) {
            ConnectedCard(device = device, colors = colors, onDisconnect = onDisconnect, onClick = onConnectedClick)
        } else {
            DeviceCard(device = device, colors = colors, onClick = onClick)
        }
    }
}

@Composable
fun ConnectedCard(device: BleDevice, colors: AppColors, onDisconnect: () -> Unit, onClick: () -> Unit = {}) {
    Card(
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = colors.surfaceConn, contentColor = colors.fg),
        border = CardDefaults.outlinedCardBorder(true),
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
    ) {
        Row(
            modifier = Modifier.padding(12.dp, 14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            SocCircle(
                soc = device.soc,
                isGlowing = true,
                trackColor = colors.track,
                modifier = Modifier.clickable(onClick = onDisconnect),
            )
            Spacer(Modifier.width(10.dp))
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(device.name, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, color = colors.fg)
                    Spacer(Modifier.weight(1f))
                    RssiIndicator(device.rssi, showDbm = true, trackColor = colors.track, fg2Color = colors.fg2)
                }
                Spacer(Modifier.height(3.dp))
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Text("%.3fV".format(device.voltageV()), color = colors.fg, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                    Text("${if (device.currentA() > 0) "+" else ""}%.3fA".format(device.currentA()), color = colors.fg, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                }
                SafetyFlagRow(device.safety, colors)
            }
        }
    }
}

@Composable
fun DeviceCard(device: BleDevice, colors: AppColors, onClick: () -> Unit) {
    Card(
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = colors.surface),
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
    ) {
        Row(
            modifier = Modifier.padding(12.dp, 14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            SocCircle(soc = device.soc, isGlowing = false, trackColor = colors.track)
            Spacer(Modifier.width(10.dp))
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(device.name, fontWeight = FontWeight.Medium, fontSize = 15.sp, color = colors.fg)
                    Spacer(Modifier.weight(1f))
                    RssiIndicator(device.rssi, showDbm = true, trackColor = colors.track, fg2Color = colors.fg2)
                }
                Spacer(Modifier.height(3.dp))
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Text("%.3fV".format(device.voltageV()), color = colors.fg, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                    Text("${if (device.currentA() > 0) "+" else ""}%.3fA".format(device.currentA()), color = colors.fg, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                }
                SafetyFlagRow(device.safety, colors)
            }
        }
    }
}

@Composable
fun SafetyFlagRow(safety: Int, colors: AppColors) {
    val flags = SafetyBits.activeFlags(safety)
    if (flags.isNotEmpty()) {
        Spacer(Modifier.height(3.dp))
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Box(
                modifier = Modifier
                    .width(1.dp)
                    .height(12.dp)
                    .background(colors.border)
            )
            Row(
                horizontalArrangement = Arrangement.spacedBy(3.dp),
                modifier = Modifier.weight(1f).horizontalScroll(rememberScrollState()),
            ) {
                flags.forEach { f ->
                    val isAlarm = f in listOf("ALERT", "P_DSG", "COM_OUT")
                    val c = if (isAlarm) Color(0xFFEAB308) else Color(0xFFEF4444)
                    Surface(
                        shape = RoundedCornerShape(3.dp),
                        color = c.copy(alpha = 0.12f),
                        border = androidx.compose.foundation.BorderStroke(1.dp, c.copy(alpha = 0.25f)),
                    ) {
                        Text(f, color = c, fontSize = 10.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(horizontal = 5.dp, vertical = 1.dp))
                    }
                }
            }
        }
    }
}

@Composable
fun RssiIndicator(rssi: Int, showDbm: Boolean = false, trackColor: Color = Color(0xFFE5E7EB), fg2Color: Color = Color(0xFF6B7280)) {
    val color = when {
        rssi > -50 -> Color(0xFF22C55E)
        rssi > -70 -> Color(0xFFEAB308)
        else -> Color(0xFFEF4444)
    }
    Text("${rssi}dBm", fontSize = 11.sp, fontWeight = FontWeight.Medium, color = color)
}

@Composable
fun SocCircle(soc: Int, isGlowing: Boolean, trackColor: Color = Color(0xFFE5E7EB), modifier: Modifier = Modifier) {
    val color = when {
        soc > 50 -> Color(0xFF22C55E)
        soc > 20 -> Color(0xFFEAB308)
        else -> Color(0xFFEF4444)
    }
    val size = 46.dp
    val stroke = 5.dp
    Box(modifier = modifier.size(size), contentAlignment = Alignment.Center) {
        Canvas(modifier = Modifier.size(size)) {
            val strokePx = stroke.toPx()
            val r = (size.toPx() - strokePx) / 2
            val center = Offset(size.toPx() / 2, size.toPx() / 2)
            drawCircle(color = trackColor, radius = r, center = center, style = Stroke(width = strokePx))
            val sweep = 360f * soc / 100f
            // Glow effect when connected
            if (isGlowing) {
                for (i in 1..3) {
                    drawArc(
                        color = color.copy(alpha = 0.08f * (4 - i)),
                        startAngle = 90f + (360f - sweep) / 2f,
                        sweepAngle = sweep,
                        useCenter = false,
                        topLeft = Offset(strokePx / 2 - i * 2, strokePx / 2 - i * 2),
                        size = Size(size.toPx() - strokePx + i * 4, size.toPx() - strokePx + i * 4),
                        style = Stroke(width = strokePx + i * 4, cap = StrokeCap.Round),
                    )
                }
            }
            drawArc(
                color = color,
                startAngle = 90f + (360f - sweep) / 2f,
                sweepAngle = sweep,
                useCenter = false,
                topLeft = Offset(strokePx / 2, strokePx / 2),
                size = Size(size.toPx() - strokePx, size.toPx() - strokePx),
                style = Stroke(width = strokePx, cap = StrokeCap.Round),
            )
        }
        Text("$soc", color = color, fontSize = 12.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
fun UiPage(
    bleManager: BleManager,
    colors: AppColors,
    webView: MutableState<WebView?>,
    darkTheme: Boolean = false,
    modifier: Modifier = Modifier,
    createWebView: (android.content.Context) -> WebView,
    pushToUi: (String, String) -> Unit,
) {
    Box(modifier = modifier.fillMaxSize()) {
        AndroidView(
            factory = createWebView,
            modifier = Modifier.fillMaxSize(),
        )
        if (!bleManager.connected.value) {
            Box(
                modifier = Modifier.fillMaxSize().background(colors.bg),
                contentAlignment = Alignment.Center,
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Default.BluetoothDisabled, contentDescription = null, modifier = Modifier.size(48.dp), tint = colors.fg3)
                    Spacer(Modifier.height(8.dp))
                    Text("请先连接蓝牙设备", color = colors.fg3, fontSize = 14.sp)
                }
            }
        }
    }
}
