plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "io.github.sdogz17.screentime"
    compileSdk = 35

    defaultConfig {
        applicationId = "io.github.sdogz17.screentime"
        minSdk = 29
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    sourceSets.getByName("main").assets.srcDir(layout.buildDirectory.dir("generated/web"))

    testOptions {
        unitTests.isIncludeAndroidResources = false
    }
}

val webIndex = layout.buildDirectory.file("generated/web/index.html")

tasks.named("preBuild").configure {
    doFirst {
        val page = webIndex.get().asFile
        if (!page.exists()) {
            throw GradleException(
                "Missing the bundled screen page at ${page.path}. From the repo root run: npm run build:screen:android",
            )
        }
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.webkit:webkit:1.12.1")
    implementation("androidx.work:work-runtime-ktx:2.10.0")
    implementation("org.json:json:20240303")
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.json:json:20240303")
}
