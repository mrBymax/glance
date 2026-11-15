package com.metaglance.android.store

import android.Manifest
import android.content.ActivityNotFoundException
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.text.InputFilter
import android.text.InputType
import android.text.method.DigitsKeyListener
import android.view.View
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.widget.Button
import android.widget.EditText
import android.widget.HorizontalScrollView
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.lifecycle.lifecycleScope
import com.google.android.gms.common.moduleinstall.ModuleInstall
import com.google.android.gms.common.moduleinstall.ModuleInstallRequest
import com.google.mlkit.common.MlKitException
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning
import com.metaglance.core.contract.StoreItemResponse
import com.metaglance.core.contract.StorePicture
import com.metaglance.core.net.StoreApiException
import com.metaglance.core.store.CodeEntry
import com.metaglance.core.store.FormCheck
import com.metaglance.core.store.FormField
import com.metaglance.core.store.StoreItemFields
import com.metaglance.core.store.StoreItemForm
import java.io.File
import java.io.IOException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * The debug screen "Add product": a person adds a product to the store list of the server with the phone alone.
 * The steps are on one screen, from the top: scan the barcode with the camera of the phone, check the form that
 * the server filled, save, and take the reference pictures. The server then knows the product with no restart.
 *
 * The scanner is the code scanner of Google Play services: it has its own full screen, and it needs no camera
 * permission of this app. The photo comes from the camera app of the phone, and the gallery from the photo picker
 * of Android. The app declares the camera permission for the mock glasses, and Android starts the camera app for
 * an app that declares it only after the person granted it. So "Take a picture" asks for it one time.
 *
 * The screen is in `app/src/debug`, so the demo build does not have it.
 */
class AddProductActivity : AppCompatActivity() {
    private lateinit var scroll: ScrollView
    private lateinit var statusView: TextView
    private lateinit var codeField: EditText
    private lateinit var codeView: TextView
    private lateinit var productSection: LinearLayout
    private lateinit var noteView: TextView
    private lateinit var nameField: EditText
    private lateinit var priceField: EditText
    private lateinit var brandField: EditText
    private lateinit var packField: EditText
    private lateinit var otherNames: LinearLayout
    private lateinit var saveButton: Button
    private lateinit var deleteButton: Button
    private lateinit var picturesSection: LinearLayout
    private lateinit var picturesLine: TextView
    private lateinit var takeButton: Button
    private lateinit var chooseButton: Button
    private lateinit var thumbnails: LinearLayout

    /** The 13 digits of the product on the screen, or null before a code. */
    private var gtin: String? = null

    /** True when the store has the item: only then the server takes pictures of it. */
    private var inStore = false
    private var picturesUsed = DEFAULT_PICTURES_USED

    /** A call to the server runs. The buttons that start one are off for that time. */
    private var busy = false

    /** The file that the camera app writes now. */
    private var photoFile: File? = null

    /** Pictures that came back while the screen still asked the server for its item, with the file of the camera app. */
    private var waitingPictures: Pair<List<Uri>, File?>? = null
    private var pictureCount = 0

    /** The thumbnails that the screen already read, by the code and the name of the picture. */
    private val thumbnailBitmaps = HashMap<String, Bitmap>()

    private val cameraRequest = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) {
            startCameraApp()
        } else {
            status("The camera permission is denied. Allow the camera for Glance in the settings of the phone, or choose a picture from the gallery.")
        }
    }
    private val takePicture = registerForActivityResult(ActivityResultContracts.TakePicture()) { saved ->
        val file = photoFile
        photoFile = null
        when {
            file == null -> Unit
            saved && file.length() > 0 -> upload(listOf(Uri.fromFile(file)), file)
            else -> {
                file.delete()
                status("No picture taken.")
            }
        }
    }
    private val pickPictures = registerForActivityResult(ActivityResultContracts.PickMultipleVisualMedia(MAX_PICKED)) { picked ->
        if (picked.isNotEmpty()) upload(picked, null)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        buildLayout()
        photoFile = savedInstanceState?.getString(STATE_PHOTO)?.let(::File)
        requestScannerModule()
        val code = savedInstanceState?.getString(STATE_GTIN) ?: intent.getStringExtra(EXTRA_GTIN)
        when {
            code != null -> useCode(CodeEntry.typed(code))
            savedInstanceState == null && intent.getBooleanExtra(EXTRA_SCAN, true) -> startScan()
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putString(STATE_GTIN, gtin)
        outState.putString(STATE_PHOTO, photoFile?.path)
    }

    // Step 1: the code.

    /**
     * Asks Google Play services for the scanner module when the screen opens. The phone downloads the module one
     * time, so the first scan can fail while the download runs. A failure here has no message: the scan reports its own.
     */
    private fun requestScannerModule() {
        val request = ModuleInstallRequest.newBuilder().addApi(GmsBarcodeScanning.getClient(this)).build()
        ModuleInstall.getClient(this).installModules(request)
    }

    private fun startScan() {
        val options = GmsBarcodeScannerOptions.Builder()
            .setBarcodeFormats(Barcode.FORMAT_EAN_13, Barcode.FORMAT_EAN_8, Barcode.FORMAT_UPC_A, Barcode.FORMAT_UPC_E)
            .enableAutoZoom()
            .build()
        GmsBarcodeScanning.getClient(this, options).startScan()
            .addOnSuccessListener { barcode -> onScreen { useCode(CodeEntry.scanned(barcode.rawValue, upcE = barcode.format == Barcode.FORMAT_UPC_E)) } }
            .addOnCanceledListener { onScreen { status(NO_SCAN) } }
            .addOnFailureListener { error -> onScreen { status(scanFailure(error)) } }
    }

    private fun scanFailure(error: Exception): String = when ((error as? MlKitException)?.errorCode) {
        MlKitException.CODE_SCANNER_CANCELLED -> NO_SCAN
        MlKitException.CODE_SCANNER_CAMERA_PERMISSION_NOT_GRANTED -> "Google Play services has no camera permission. Allow it in the settings of the phone, or type the digits."
        MlKitException.CODE_SCANNER_UNAVAILABLE, MlKitException.UNAVAILABLE -> {
            requestScannerModule()
            "The scanner of Google Play services is not ready. The phone downloads it now. Scan again in a minute, or type the digits."
        }
        MlKitException.CODE_SCANNER_GOOGLE_PLAY_SERVICES_VERSION_TOO_OLD -> "Google Play services is too old for the scanner. Update it, or type the digits."
        else -> "The scanner failed: ${error.message ?: error.javaClass.simpleName}. Type the digits."
    }

    private fun useCode(entry: CodeEntry) {
        when (entry) {
            is CodeEntry.Wrong -> status(entry.message)
            is CodeEntry.Code -> load(entry.gtin13, null)
        }
    }

    /** Asks the server for the code and fills the form. `done` is the status line after the answer, or null for the note of the form. */
    private fun load(code: String, done: String?) {
        if (busy) return
        gtin = code
        codeField.setText(code)
        codeView.text = "Code $code"
        productSection.visibility = View.GONE
        picturesSection.visibility = View.GONE
        working("Asks the server about $code.")
        lifecycleScope.launch {
            val answer = try {
                withContext(Dispatchers.IO) { StoreScreens.api(this@AddProductActivity).item(code) }
            } catch (e: StoreApiException) {
                waitingPictures?.second?.delete()
                waitingPictures = null
                failed("${e.message} Tap \"Use this code\" to try again.")
                return@launch
            }
            show(answer, done)
        }
    }

    // Step 2: the form.

    private fun show(answer: StoreItemResponse, done: String?) {
        busy = false
        val filled = StoreItemForm.fill(answer)
        inStore = answer.item != null
        picturesUsed = answer.picturesUsed
        nameField.setText(filled.fields.name)
        priceField.setText(filled.fields.price)
        brandField.setText(filled.fields.brand)
        packField.setText(filled.fields.packSize)
        for (field in listOf(nameField, priceField, brandField, packField)) field.error = null
        noteView.text = filled.note
        otherNames.removeAllViews()
        for (name in filled.otherNames) {
            val use = StoreScreens.button(this, "Use the name: $name") { nameField.setText(name) }
            use.textSize = StoreScreens.SMALL_SP
            otherNames.addView(use, StoreScreens.wide(this))
        }
        productSection.visibility = View.VISIBLE
        picturesSection.visibility = View.VISIBLE
        showPictures(answer.pictures)
        refreshButtons()
        status(done ?: filled.note)
        // A new item with a name needs only its price, so the price field has the keyboard.
        val next = when {
            inStore -> null
            filled.fields.name.isEmpty() -> nameField
            else -> priceField
        }
        if (next != null) {
            next.requestFocus()
            getSystemService(InputMethodManager::class.java)?.showSoftInput(next, InputMethodManager.SHOW_IMPLICIT)
        }
        val waiting = waitingPictures
        waitingPictures = null
        if (waiting != null) upload(waiting.first, waiting.second)
    }

    private fun save() {
        val code = gtin ?: return
        if (busy) return
        val fields = StoreItemFields(nameField.text.toString(), priceField.text.toString(), brandField.text.toString(), packField.text.toString())
        val body = when (val check = StoreItemForm.check(fields)) {
            is FormCheck.Ready -> check.body
            is FormCheck.Invalid -> {
                val views = mapOf(FormField.NAME to nameField, FormField.PRICE to priceField, FormField.BRAND to brandField, FormField.PACK_SIZE to packField)
                for ((field, view) in views) view.error = check.errors[field]
                val (first, message) = check.errors.entries.first()
                views.getValue(first).requestFocus()
                status(message)
                return
            }
        }
        working("Saves the item.")
        lifecycleScope.launch {
            val saved = try {
                withContext(Dispatchers.IO) { StoreScreens.api(this@AddProductActivity).save(code, body) }
            } catch (e: StoreApiException) {
                failed(e.message.orEmpty())
                return@launch
            }
            busy = false
            inStore = true
            nameField.setText(saved.name)
            hideKeyboard()
            refreshButtons()
            status("Saved. The glasses know it now. Add pictures below.")
        }
    }

    private fun confirmDelete() {
        val code = gtin ?: return
        AlertDialog.Builder(this)
            .setMessage("Delete ${nameField.text} and its pictures from the store?")
            .setPositiveButton("Delete") { _, _ -> delete(code) }
            .setNegativeButton("Keep", null)
            .show()
    }

    private fun delete(code: String) {
        if (busy) return
        working("Deletes the item.")
        lifecycleScope.launch {
            try {
                withContext(Dispatchers.IO) { StoreScreens.api(this@AddProductActivity).remove(code) }
            } catch (e: StoreApiException) {
                failed(e.message.orEmpty())
                return@launch
            }
            busy = false
            load(code, "Deleted. The glasses no longer offer it.")
        }
    }

    // Step 3: the pictures.

    private fun takePicture() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            startCameraApp()
        } else {
            cameraRequest.launch(Manifest.permission.CAMERA)
        }
    }

    private fun startCameraApp() {
        val folder = File(cacheDir, PHOTO_FOLDER)
        folder.mkdirs()
        val file = File(folder, "photo-${System.currentTimeMillis()}.jpg")
        photoFile = file
        try {
            takePicture.launch(FileProvider.getUriForFile(this, "$packageName$FILES_AUTHORITY", file))
        } catch (_: ActivityNotFoundException) {
            photoFile = null
            status("This phone has no camera app. Choose a picture from the gallery.")
        }
    }

    private fun choosePictures() {
        pickPictures.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
    }

    /** Makes each picture small and sends it. `taken` is the file of the camera app, which the phone does not keep. */
    private fun upload(sources: List<Uri>, taken: File?) {
        val code = gtin
        // Android can start the screen again behind the camera app. The picture then arrives while the item loads.
        if (code != null && busy) {
            waitingPictures = sources to taken
            return
        }
        if (code == null || !inStore) {
            taken?.delete()
            return
        }
        working("Reads the picture.")
        lifecycleScope.launch {
            var pictures: List<StorePicture>? = null
            var sent = 0
            var problem: String? = null
            for ((index, source) in sources.withIndex()) {
                val place = if (sources.size == 1) "The picture" else "Picture ${index + 1} of ${sources.size}"
                status("$place: makes it smaller.")
                val jpeg = try {
                    withContext(Dispatchers.IO) { PicturePrep.jpeg(contentResolver, source) }
                } catch (e: IOException) {
                    problem = "$place did not open: ${e.message}"
                    break
                } catch (e: SecurityException) {
                    problem = "$place did not open: ${e.message}"
                    break
                }
                status("$place: sends ${jpeg.size / BYTES_IN_KB} kB.")
                try {
                    pictures = withContext(Dispatchers.IO) { StoreScreens.api(this@AddProductActivity).addPicture(code, jpeg) }.pictures
                    sent += 1
                } catch (e: StoreApiException) {
                    problem = e.message
                    break
                }
            }
            taken?.delete()
            busy = false
            pictures?.let(::showPictures)
            refreshButtons()
            val saved = if (sent == 0) "" else "${StoreItemForm.pictureCount(sent)} saved. The glasses use them from the next look."
            status(listOfNotNull(saved.ifEmpty { null }, problem).joinToString(" "))
        }
    }

    private fun showPictures(pictures: List<StorePicture>) {
        val code = gtin ?: return
        pictureCount = pictures.size
        thumbnails.removeAllViews()
        val side = StoreScreens.dp(this, THUMBNAIL_DP)
        for (picture in pictures) {
            val cell = LinearLayout(this)
            cell.orientation = LinearLayout.VERTICAL
            val image = ImageView(this)
            image.scaleType = ImageView.ScaleType.CENTER_CROP
            image.setBackgroundColor(Color.LTGRAY)
            image.contentDescription = "Picture ${picture.name}"
            cell.addView(image, LinearLayout.LayoutParams(side, side))
            val remove = StoreScreens.button(this, "Delete") { removePicture(code, picture.name) }
            remove.textSize = StoreScreens.SMALL_SP
            cell.addView(remove, LinearLayout.LayoutParams(side, LinearLayout.LayoutParams.WRAP_CONTENT))
            val params = LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            params.marginEnd = StoreScreens.dp(this, StoreScreens.GAP_DP)
            thumbnails.addView(cell, params)
            val key = "$code/${picture.name}"
            val known = thumbnailBitmaps[key]
            if (known != null) {
                image.setImageBitmap(known)
                continue
            }
            lifecycleScope.launch {
                // A thumbnail that fails stays gray. The line of the pictures still counts it.
                val bitmap = try {
                    withContext(Dispatchers.IO) { PicturePrep.thumbnail(StoreScreens.api(this@AddProductActivity).picture(code, picture.name), side) }
                } catch (_: StoreApiException) {
                    null
                }
                if (bitmap != null) {
                    thumbnailBitmaps[key] = bitmap
                    image.setImageBitmap(bitmap)
                }
            }
        }
    }

    private fun removePicture(code: String, name: String) {
        if (busy) return
        working("Deletes the picture.")
        lifecycleScope.launch {
            val pictures = try {
                withContext(Dispatchers.IO) { StoreScreens.api(this@AddProductActivity).removePicture(code, name) }.pictures
            } catch (e: StoreApiException) {
                failed(e.message.orEmpty())
                return@launch
            }
            busy = false
            showPictures(pictures)
            refreshButtons()
            status("Picture deleted.")
        }
    }

    // The state of the screen.

    private fun next() {
        gtin = null
        inStore = false
        thumbnailBitmaps.clear()
        codeField.setText("")
        codeView.text = ""
        productSection.visibility = View.GONE
        picturesSection.visibility = View.GONE
        scroll.scrollTo(0, 0)
        status("Scan the barcode of the next product.")
        startScan()
    }

    private fun working(line: String) {
        busy = true
        refreshButtons()
        status(line)
    }

    private fun failed(line: String) {
        busy = false
        refreshButtons()
        status(line)
    }

    private fun refreshButtons() {
        saveButton.isEnabled = !busy
        deleteButton.isEnabled = !busy
        deleteButton.visibility = if (inStore) View.VISIBLE else View.GONE
        takeButton.isEnabled = inStore && !busy
        chooseButton.isEnabled = inStore && !busy
        picturesLine.text = if (inStore) StoreItemForm.picturesLine(pictureCount, picturesUsed) else "Save the item first. Then add its pictures."
    }

    private fun status(line: String) {
        statusView.text = line
    }

    /** A result of Google Play services can arrive after the person left the screen. */
    private fun onScreen(action: () -> Unit) {
        if (!isFinishing && !isDestroyed) action()
    }

    private fun hideKeyboard() {
        val focused = currentFocus ?: return
        getSystemService(InputMethodManager::class.java)?.hideSoftInputFromWindow(focused.windowToken, 0)
    }

    // The views.

    private fun buildLayout() {
        val pad = StoreScreens.dp(this, StoreScreens.PAD_DP)
        val root = LinearLayout(this)
        root.orientation = LinearLayout.VERTICAL
        root.fitsSystemWindows = true
        root.setPadding(pad, pad, pad, pad)

        val title = StoreScreens.text(this, StoreScreens.TITLE_SP, bold = true)
        title.text = "Add product"
        root.addView(title, StoreScreens.wide(this))

        // The status line stays in view while the form scrolls.
        statusView = StoreScreens.text(this, StoreScreens.TEXT_SP)
        statusView.text = "Scan the barcode of the product."
        root.addView(statusView, StoreScreens.wide(this, StoreScreens.GAP_DP))

        val content = LinearLayout(this)
        content.orientation = LinearLayout.VERTICAL
        scroll = ScrollView(this)
        scroll.addView(content)
        root.addView(scroll, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f))

        addCodeStep(content)
        productSection = section(content)
        addForm(productSection)
        picturesSection = section(content)
        addPictures(picturesSection)
        setContentView(root)
    }

    private fun section(parent: LinearLayout): LinearLayout {
        val section = LinearLayout(this)
        section.orientation = LinearLayout.VERTICAL
        section.visibility = View.GONE
        parent.addView(section, StoreScreens.wide(this))
        return section
    }

    private fun heading(parent: LinearLayout, text: String) {
        val view = StoreScreens.text(this, StoreScreens.TEXT_SP, bold = true)
        view.text = text
        parent.addView(view, StoreScreens.wide(this, 2 * StoreScreens.GAP_DP))
    }

    private fun addCodeStep(parent: LinearLayout) {
        heading(parent, "1. Barcode")
        parent.addView(StoreScreens.button(this, "Scan barcode") { startScan() }, StoreScreens.wide(this, StoreScreens.GAP_DP))
        codeField = field(parent, "Or type the digits under the barcode", InputType.TYPE_CLASS_NUMBER, CODE_MAX)
        codeField.imeOptions = EditorInfo.IME_ACTION_GO
        codeField.setOnEditorActionListener { _, _, _ ->
            useCode(CodeEntry.typed(codeField.text.toString()))
            true
        }
        parent.addView(StoreScreens.button(this, "Use this code") { useCode(CodeEntry.typed(codeField.text.toString())) }, StoreScreens.wide(this))
        codeView = StoreScreens.text(this, StoreScreens.SMALL_SP)
        parent.addView(codeView, StoreScreens.wide(this))
    }

    private fun addForm(parent: LinearLayout) {
        heading(parent, "2. Product")
        noteView = StoreScreens.text(this, StoreScreens.SMALL_SP)
        parent.addView(noteView, StoreScreens.wide(this))
        nameField = field(parent, "Name", InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_SENTENCES, StoreItemForm.NAME_MAX + 1)
        otherNames = LinearLayout(this)
        otherNames.orientation = LinearLayout.VERTICAL
        parent.addView(otherNames, StoreScreens.wide(this))
        priceField = field(parent, "Price in euros, for example 2.49", InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_FLAG_DECIMAL, PRICE_MAX)
        // The decimal keyboard of some phones has a comma and no point. This listener takes both, and the raw
        // input type keeps the keyboard with digits.
        priceField.keyListener = DigitsKeyListener.getInstance("0123456789.,")
        priceField.setRawInputType(InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_FLAG_DECIMAL)
        priceField.imeOptions = EditorInfo.IME_ACTION_DONE
        priceField.setOnEditorActionListener { _, _, _ ->
            save()
            true
        }
        brandField = field(parent, "Brand (optional)", InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_WORDS, StoreItemForm.BRAND_MAX + 1)
        packField = field(parent, "Pack size (optional), for example 500 g", InputType.TYPE_CLASS_TEXT, StoreItemForm.PACK_SIZE_MAX + 1)
        saveButton = StoreScreens.button(this, "Save") { save() }
        parent.addView(saveButton, StoreScreens.wide(this, StoreScreens.GAP_DP))
        deleteButton = StoreScreens.button(this, "Delete this item") { confirmDelete() }
        parent.addView(deleteButton, StoreScreens.wide(this))
    }

    private fun addPictures(parent: LinearLayout) {
        heading(parent, "3. Pictures")
        val hint = StoreScreens.text(this, StoreScreens.SMALL_SP)
        hint.text = "Front of the pack. Then the side with the barcode."
        parent.addView(hint, StoreScreens.wide(this))
        takeButton = StoreScreens.button(this, "Take a picture") { takePicture() }
        parent.addView(takeButton, StoreScreens.wide(this, StoreScreens.GAP_DP))
        chooseButton = StoreScreens.button(this, "Choose from gallery") { choosePictures() }
        parent.addView(chooseButton, StoreScreens.wide(this))
        picturesLine = StoreScreens.text(this, StoreScreens.SMALL_SP)
        parent.addView(picturesLine, StoreScreens.wide(this, StoreScreens.GAP_DP))
        thumbnails = LinearLayout(this)
        thumbnails.orientation = LinearLayout.HORIZONTAL
        val row = HorizontalScrollView(this)
        row.addView(thumbnails)
        parent.addView(row, StoreScreens.wide(this, StoreScreens.GAP_DP))
        parent.addView(StoreScreens.button(this, "Scan the next product") { next() }, StoreScreens.wide(this, 2 * StoreScreens.GAP_DP))
    }

    /** A caption and its field. The caption stays in view when the field has text. */
    private fun field(parent: LinearLayout, caption: String, inputType: Int, maxLength: Int): EditText {
        val label = StoreScreens.text(this, StoreScreens.SMALL_SP)
        label.text = caption
        parent.addView(label, StoreScreens.wide(this, StoreScreens.GAP_DP))
        val field = EditText(this)
        field.inputType = inputType
        field.isSingleLine = true
        field.textSize = StoreScreens.TITLE_SP
        field.minHeight = StoreScreens.dp(this, StoreScreens.BUTTON_HEIGHT_DP)
        field.filters = arrayOf(InputFilter.LengthFilter(maxLength))
        field.contentDescription = caption
        parent.addView(field, StoreScreens.wide(this))
        return field
    }

    companion object {
        /** A code of 8, 12, or 13 digits: the screen opens with the item of this code. */
        const val EXTRA_GTIN = "gtin"

        /** false: the screen does not open the scanner at its start. The default is true. */
        const val EXTRA_SCAN = "scan"

        private const val STATE_GTIN = "gtin"
        private const val STATE_PHOTO = "photo"
        private const val NO_SCAN = "No code scanned. Scan again, or type the digits."
        private const val PHOTO_FOLDER = "store-pictures"

        /** The end of the authority of the FileProvider in the debug manifest. */
        private const val FILES_AUTHORITY = ".storefiles"
        private const val DEFAULT_PICTURES_USED = 3
        private const val MAX_PICKED = 3
        private const val THUMBNAIL_DP = 112
        private const val BYTES_IN_KB = 1024

        /** One more than 13 digits, so the screen can say that a code is too long. */
        private const val CODE_MAX = 14
        private const val PRICE_MAX = 10
    }
}
