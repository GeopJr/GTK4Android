import AppInfoParser from "app-info-parser"
import { readdir, writeFile, mkdir, stat, readFile, cp, rm } from "fs/promises"
import { join, basename } from "path"
// import { Axml2xml } from "axml2xml"
// import { transform } from "vector-drawable-svg"

// function icon2svg(dataUrl, outputPath) {
//     const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, "")
//     const buffer = Buffer.from(base64, "base64")
//     return writeFile(outputPath, transform(Axml2xml.convert(buffer)))
// }

/**
 * Creates HTML anchor card from metadata
 * @param {string} app_id The app id, shared by the apk and icon
 * @param {string} name The app name
 * @param {string} version The app version
 * @param {string} creation The datetime the apk was created
 * @returns {string}
 */
function toAnchor(app_id, name, version, creation) {
    return `
    <a href="/apks/${app_id}.apk">
        <img src="/images/${app_id}.svg" alt="" aria-hidden="true" />
        <div>
            <h3>${name}</h3>
            <p>Date: ${creation}</p>
            <span>${version}</span>
        </div>
    </a>
    `.trim()
}

/**
 * Creates the final index.html from the template and anchors
 * @param {{gtk: string[], adw: string[], granite: string[]}} anchors The generated app anchors
 */
async function writeIndex(anchors) {
    await writeFile("./deploy/index.html", (await readFile("template.html", { encoding: "utf-8" }))
        .replace("<!-- GTK4ANDROID:ADW:CARDS -->", anchors.adw.join("\n"))
        .replace("<!-- GTK4ANDROID:GRANITE:CARDS -->", anchors.granite.join("\n"))
        .replace("<!-- GTK4ANDROID:GTK:CARDS -->", anchors.gtk.join("\n")))
}

const files = await readdir("apks")

const concurrency = 5
const results = []

for (let i = 0; i < files.length; i += concurrency) {
    const batch = files.slice(i, i + concurrency)

    const batchResults = await Promise.all(
        batch.map(file => new AppInfoParser(join("apks", file)).parse().then(async x => {
            x.file = file
            x.creation = new Date((await stat(join("apks", file))).mtimeMs).toISOString().slice(0, 10)
            return x
        }))
    )

    results.push(...batchResults)
}

const anchors = {
    gtk: [],
    adw: [],
    granite: []
}

results.sort((a, b) => a.application.label[0].localeCompare(b.application.label[0])).forEach(metadata => {
    anchors[metadata.platform.granite ? "granite" : (metadata.platform.libadwaita ? "adw" : "gtk")].push(
        toAnchor(basename(metadata.file, ".apk"), metadata.application.label[0], metadata.versionName, metadata.creation)
    )
})

await rm("deploy", { force: true, recursive: true })
await mkdir("deploy")
await writeIndex(anchors)
await cp("./apks", "./deploy/apks", { recursive: true })
await cp("./images", "./deploy/images", { recursive: true })
await cp("./assets", "./deploy/assets", { recursive: true })
