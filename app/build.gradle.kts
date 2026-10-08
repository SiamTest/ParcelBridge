plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }

android {
    namespace = "com.parcelbridge.app"
    compileSdk = 36
    defaultConfig {
        applicationId = "com.parcelbridge.app"
        minSdk = 26
        targetSdk = 36
        versionCode = (System.getenv("APP_VERSION_CODE") ?: "1").toInt()
        versionName = System.getenv("APP_VERSION_NAME") ?: "0.1.0"
        val api = System.getenv("API_BASE_URL") ?: ""
        require(api.isEmpty() || (api.startsWith("https://") && !api.contains('"') && !api.contains('\\') && !api.contains('\n')))
        buildConfigField("String", "API_BASE_URL", "\"$api\"")
    }
    signingConfigs {
        create("release") {
            val key = System.getenv("ANDROID_KEYSTORE_PATH")
            if (key != null) {
                storeFile = file(key)
                storePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("ANDROID_KEY_ALIAS")
                keyPassword = System.getenv("ANDROID_KEY_PASSWORD")
            }
        }
    }
    buildTypes {
        release { signingConfig = signingConfigs.getByName("release") }
    }
    flavorDimensions += "distribution"
    productFlavors {
        create("direct") { dimension = "distribution"; applicationIdSuffix = ".direct" }
        create("play") { dimension = "distribution" }
    }
    buildFeatures { buildConfig = true }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
}
dependencies {
    "directImplementation"("androidx.core:core-ktx:1.16.0")
    "playImplementation"("com.google.android.play:app-update:2.1.0")
    testImplementation("junit:junit:4.13.2")
}
