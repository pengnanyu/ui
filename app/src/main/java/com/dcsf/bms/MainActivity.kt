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

import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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

object LogCollector {
    private val _logs = mutableStateListOf<String>()
    val logs: List<String> get() = _logs
    private const val MAX = 200

    fun log(tag: String, msg: String) {
        val ts = java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.US).format(java.util.Date())
        val entry = "$ts $tag $msg"
        _logs.add(entry)
        if (_logs.size > MAX) _logs.removeAt(0)
    }

    fun clear() { _logs.clear() }
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
        val Light = AppColors(
            bg = Color(0xFFF5F7FA),
            surface = Color.White,
            surfaceConn = Color(0xFFECFDF5),
            surfaceConnBorder = Color(0xFFA7F3D0),
            fg = Color(0xFF1A1A2E),
            fg2 = Color(0xFF6B7280),
            fg3 = Color(0xFF9CA3AF),
            border = Color(0xFFE5E7EB),
            primary = Color(0xFF3B82F6),
            primaryFg = Color.White,
            track = Color(0xFFE5E7EB),
            navBg = Color.White,
            danger = Color(0xFFEF4444),
            swipeBg = Color(0xFFEF4444),
        )
        val Dark = AppColors(
            bg = Color(0xFF1A1B2E),
            surface = Color(0xFF252640),
            surfaceConn = Color(0xFF0D2818),
            surfaceConnBorder = Color(0xFF166534),
            fg = Color(0xFFE5E5E5),
            fg2 = Color(0xFF9CA3AF),
            fg3 = Color(0xFF6B7280),
            border = Color(0xFF333450),
            primary = Color(0xFF60A5FA),
            primaryFg = Color.White,
            track = Color(0xFF333450),
            navBg = Color(0xFF1E1F36),
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

fun pushToUi(webView: MutableState<WebView?>, type: String, payloadJson: String) {
    val wv = webView.value ?: return
    Log.d("BMS_UI", "pushToUi: type=$type payload=${payloadJson.take(100)}")
    LogCollector.log("UI", "push $type ${payloadJson.take(60)}")
    val js = "if(window.__APP_BRIDGE__&&window.__APP_BRIDGE__._handler){window.__APP_BRIDGE__._handler({type:'" + type + "',payload:" + payloadJson + "})}else{console.log('BRIDGE:_handler_not_ready')}"
    wv.post { wv.evaluateJavascript(js, null) }
}

class MainActivity : ComponentActivity() {
    private val bleManager = BleManager()

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
        LogCollector.log("BLE", "Connecting ${device.name}...")
        bleManager.connect(this, device) { connected ->
            runOnUiThread {
                bleManager.connected.value = connected
                if (!connected) bleManager.connectionError.value = true
                LogCollector.log("BLE", if (connected) "Connected" else "Connection failed")
            }
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
}

data class BleDevice(
    val name: String,
    val address: String,
    val rssi: Int,
    val soc: Int = 0,
    val voltage: Int = 0,
    val current: Int = 0,
    val safety: Int = 0,
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

    companion object {
        const val SERVICE_UUID = "0000ff00-0000-1000-8000-00805f9b34fb"
        const val NOTIFY_UUID = "0000ff01-0000-1000-8000-00805f9b34fb"
        const val WRITE_UUID = "0000ff02-0000-1000-8000-00805f9b34fb"
        const val NAME_PREFIX = "DCSF+"
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
                val bytes = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) scanRecord.bytes else getScanRecordBytes(scanRecord)
                if (bytes != null) {
                    Log.d("BMS_BLE", "ScanRecord bytes for $name: ${bytes.joinToString(",") { "%02x".format(it) }}")
                    val parsed = parseAdData(bytes)
                    if (parsed != null) {
                        soc = parsed[0]; voltage = parsed[1]; current = parsed[2]; safety = parsed[3]
                        Log.d("BMS_BLE", "Parsed: soc=$soc voltage=$voltage current=$current safety=$safety")
                        LogCollector.log("BLE", "Adv: soc=$soc V=$voltage I=$current safety=$safety")
                    } else {
                        Log.d("BMS_BLE", "parseAdData returned null")
                        LogCollector.log("BLE", "Adv parse failed")
                    }
                }
            }

            val existing = devices.indexOfFirst { it.address == result.device.address }
            val device = BleDevice(name, result.device.address, result.rssi, soc, voltage, current, safety)

            if (existing >= 0) {
                devices[existing] = device
            } else if (devices.size < MAX_DEVICES) {
                devices.add(device)
            }
        }

        override fun onScanFailed(errorCode: Int) {
            scanning.value = false
            scanStatus.value = "Scan failed: $errorCode"
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
        val filter = ScanFilter.Builder()
            .setDeviceName(NAME_PREFIX)
            .build()
        val settings = android.bluetooth.le.ScanSettings.Builder()
            .setScanMode(android.bluetooth.le.ScanSettings.SCAN_MODE_BALANCED)
            .build()
        try {
            scanner.startScan(listOf(filter), settings, scanCallback)
        } catch (e: SecurityException) {
            scanStatus.value = "SecurityException: ${e.message}"
            scanning.value = false
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

        bleConnection = BleConnection(btDevice, SERVICE_UUID, NOTIFY_UUID, WRITE_UUID)
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
        return bleConnection?.write(data) ?: false
    }

    fun setOnDataReceived(callback: (ByteArray) -> Unit) {
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
) {
    var selectedTab by remember { mutableIntStateOf(0) }
    val webView = remember { mutableStateOf<WebView?>(null) }
    val configuration = LocalConfiguration.current
    val isWideScreen = configuration.screenWidthDp >= 600
    val themeStr = if (darkTheme) "dark" else "light"

    LaunchedEffect(bleManager.connected.value) {
        val status = if (bleManager.connected.value) "connected" else "disconnected"
        pushToUi(webView, "bms:connection-status", """{"status":"$status"}""")
        if (bleManager.connected.value) {
            selectedTab = 1
        }
    }

    LaunchedEffect(Unit) {
        bleManager.setOnDataReceived { data ->
            val dataJson = data.toList().toString()
            pushToUi(webView, "bms:raw-data", """{"data":$dataJson}""")
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
            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView?, url: String?) {
                    Log.d("BMS_UI", "Page finished: $url")
                    super.onPageFinished(view, url)
                    view?.evaluateJavascript("localStorage.setItem('bms-theme','$themeStr')", null)

                    val shim = """
                        window.__APP_BRIDGE__ = {
                            _handler: null,
                            onMessage: function(cb) { this._handler = cb; },
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
            }
            webChromeClient = object : android.webkit.WebChromeClient() {
                override fun onConsoleMessage(consoleMessage: android.webkit.ConsoleMessage): Boolean {
                    Log.d("BMS_JS", "${consoleMessage.message()} -- ${consoleMessage.sourceId()}:${consoleMessage.lineNumber()}")
                    LogCollector.log("JS", consoleMessage.message().take(80))
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
                                val frameArr = payload?.optJSONArray("frame")
                                if (frameArr != null) {
                                    val frame = ByteArray(frameArr.length()) { frameArr.getInt(it).toByte() }
                                    bleManager.send(frame)
                                }
                            }
                            "bms:request-status" -> {
                                val status = if (bleManager.connected.value) "connected" else "disconnected"
                                pushToUi(webView, "bms:connection-status", """{"status":"$status"}""")
                            }
                        }
                    } catch (_: Exception) {}
                }

                @android.webkit.JavascriptInterface
                fun sendFrame(json: String) {
                    val nums = json.trim('[', ']').split(',').mapNotNull { it.trim().toIntOrNull() }
                    val frame = ByteArray(nums.size) { nums[it].toByte() }
                    bleManager.send(frame)
                }

                @android.webkit.JavascriptInterface
                fun getPlatform(): String {
                    return """{"platform":"app","version":"1.0.0","bluetoothSupported":true,"serialSupported":false}"""
                }
            }, "__NativeBridge__")
            loadUrl("https://ui.bms.pub")
            webView.value = this
        }
    }



    if (isWideScreen) {
        Row(
            modifier = Modifier
                .fillMaxSize()
                .background(colors.bg)
        ) {
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
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxHeight()
            ) {
                if (bleManager.connected.value) {
                    AndroidView(
                        factory = createWebView,
                        modifier = Modifier.fillMaxSize(),
                    )
                } else {
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
            when (selectedTab) {
                0 -> BluetoothPage(
                    bleManager = bleManager,
                    colors = colors,
                    onRequestPermissions = onRequestPermissions,
                    onConnectDevice = onConnectDevice,
                    onDisconnect = onDisconnect,
                    onConnectedClick = { selectedTab = 1 },
                    modifier = Modifier.padding(padding),
                )
                1 -> Column(modifier = Modifier.fillMaxSize().padding(if (showBottomBar) padding else PaddingValues())) {
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
            IconButton(onClick = {
                if (bleManager.scanning.value) {
                    bleManager.stopScan()
                } else {
                    if (hasBlePermissions(context)) {
                        bleManager.startScan(context)
                    } else {
                        onRequestPermissions()
                    }
                }
            }) {
                Icon(
                    Icons.Default.Refresh,
                    contentDescription = "刷新",
                    tint = if (bleManager.scanning.value) colors.primary else colors.fg2,
                )
            }
        }

        if (bleManager.scanning.value) {
            LinearProgressIndicator(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 8.dp),
                color = colors.primary,
            )
        }
        if (bleManager.scanStatus.value.isNotEmpty()) {
            Text(
                bleManager.scanStatus.value,
                color = colors.fg2,
                fontSize = 12.sp,
                modifier = Modifier.padding(vertical = 4.dp),
            )
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
                    Text(if (bleManager.scanStatus.value.isNotEmpty()) bleManager.scanStatus.value else "未发现设备", color = colors.fg3, fontSize = 14.sp)
                    Spacer(Modifier.height(16.dp))
                    Button(
                        onClick = {
                            if (hasBlePermissions(context)) {
                                bleManager.startScan(context)
                            } else {
                                onRequestPermissions()
                            }
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
                modifier = Modifier.fillMaxSize(),
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
                if (expanded) "调试日志 ▼" else "调试日志 ▶",
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
                modifier = Modifier.fillMaxWidth().heightIn(max = 200.dp),
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
                    Text("${if (device.currentA() > 0) "+" else ""}${device.currentA()}A", color = colors.fg, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
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
                    Text("${if (device.currentA() > 0) "+" else ""}${device.currentA()}A", color = colors.fg, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
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
    val bars = when {
        rssi > -50 -> 4
        rssi > -60 -> 3
        rssi > -70 -> 2
        else -> 1
    }
    Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
        repeat(4) { i ->
            Box(
                modifier = Modifier
                    .width(3.dp)
                    .height((6 + i * 3).dp)
                    .background(if (i < bars) color else trackColor, RoundedCornerShape(1.dp)),
            )
        }
        if (showDbm) {
            Text("${rssi}dBm", fontSize = 10.sp, fontWeight = FontWeight.Medium, color = fg2Color)
        }
    }
}

@Composable
fun SocCircle(soc: Int, isGlowing: Boolean, trackColor: Color = Color(0xFFE5E7EB), modifier: Modifier = Modifier) {
    val color = when {
        soc > 50 -> Color(0xFF22C55E)
        soc > 20 -> Color(0xFFEAB308)
        else -> Color(0xFFEF4444)
    }
    val size = 44.dp
    Box(modifier = modifier.size(size), contentAlignment = Alignment.Center) {
        Canvas(modifier = Modifier.size(size)) {
            val stroke = 4.dp.toPx()
            val r = (size.toPx() - stroke) / 2
            val center = Offset(size.toPx() / 2, size.toPx() / 2)
            drawCircle(color = trackColor, radius = r, center = center, style = Stroke(width = stroke))
            val sweep = 360f * soc / 100f
            drawArc(
                color = color,
                startAngle = 90f + (360f - sweep) / 2f,
                sweepAngle = sweep,
                useCenter = false,
                topLeft = Offset(stroke / 2, stroke / 2),
                size = Size(size.toPx() - stroke, size.toPx() - stroke),
                style = Stroke(width = stroke, cap = StrokeCap.Round),
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
    if (!bleManager.connected.value) {
        Box(
            modifier = modifier.fillMaxSize().background(colors.bg),
            contentAlignment = Alignment.Center,
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(Icons.Default.BluetoothDisabled, contentDescription = null, modifier = Modifier.size(48.dp), tint = colors.fg3)
                Spacer(Modifier.height(8.dp))
                Text("请先连接蓝牙设备", color = colors.fg3, fontSize = 14.sp)
            }
        }
        return
    }

    AndroidView(
        factory = createWebView,
        modifier = modifier.fillMaxSize(),
    )
}
