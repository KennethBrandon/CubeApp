const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const PACKAGE_JSON_PATH = path.join(__dirname, '../package.json');
const ANDROID_GRADLE_PATH = path.join(__dirname, '../android/app/build.gradle');
const INDEX_HTML_PATH = path.join(__dirname, '../index.html');

// Helper: Parse version string "X.Y.Z"
function parseVersion(versionStr) {
    const parts = versionStr.split('.').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) {
        throw new Error(`Invalid version format: ${versionStr}. Expected X.Y.Z`);
    }
    return { major: parts[0], minor: parts[1], patch: parts[2] };
}

// Helper: Calculate Android version code
// Strategy: Major * 10000 + Minor * 100 + Patch
// Example: 1.2.3 -> 10203
// Example: 0.1.0 -> 100
function calculateVersionCode(major, minor, patch) {
    return (major * 10000) + (minor * 100) + patch;
}

// 1. Determine Target Version
const args = process.argv.slice(2);
// Filter out flags from version arguments
const versionArgs = args.filter(arg => !arg.startsWith('--'));
const flags = args.filter(arg => arg.startsWith('--'));
const shouldGitTag = flags.includes('--git-tag');

let targetVersionStr = versionArgs[0];

const packageJson = require(PACKAGE_JSON_PATH);
const currentVersion = parseVersion(packageJson.version);

if (!targetVersionStr) {
    // If no argument provided, just sync current package.json version to Android
    console.log(`No version argument provided. Syncing current version ${packageJson.version} to Android...`);
    targetVersionStr = packageJson.version;
} else if (['major', 'minor', 'patch'].includes(targetVersionStr.toLowerCase())) {
    // Handle bump keywords
    const type = targetVersionStr.toLowerCase();
    if (type === 'major') {
        currentVersion.major++;
        currentVersion.minor = 0;
        currentVersion.patch = 0;
    } else if (type === 'minor') {
        currentVersion.minor++;
        currentVersion.patch = 0;
    } else if (type === 'patch') {
        currentVersion.patch++;
    }
    targetVersionStr = `${currentVersion.major}.${currentVersion.minor}.${currentVersion.patch}`;
    console.log(`Bumping ${type} version to ${targetVersionStr}...`);
} else {
    console.log(`Setting version to specific value ${targetVersionStr}...`);
}

// Validate the target version
const targetVer = parseVersion(targetVersionStr);
const versionCode = calculateVersionCode(targetVer.major, targetVer.minor, targetVer.patch);

// 2. Update package.json
packageJson.version = targetVersionStr;
fs.writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(packageJson, null, 2) + '\n');
console.log(`Updated package.json to ${targetVersionStr}`);

// 3. Update android/app/build.gradle
let filesToStage = ['package.json'];
if (fs.existsSync(ANDROID_GRADLE_PATH)) {
    let gradleContent = fs.readFileSync(ANDROID_GRADLE_PATH, 'utf8');

    // Regex to match versionCode and versionName
    // We use a safe regex that respects the existing formatting
    const versionCodeRegex = /versionCode\s+\d+/;
    const versionNameRegex = /versionName\s+"[^"]+"/;

    if (versionCodeRegex.test(gradleContent) && versionNameRegex.test(gradleContent)) {
        gradleContent = gradleContent.replace(versionCodeRegex, `versionCode ${versionCode}`);
        gradleContent = gradleContent.replace(versionNameRegex, `versionName "${targetVersionStr}"`);

        fs.writeFileSync(ANDROID_GRADLE_PATH, gradleContent);
        console.log(`Updated android/app/build.gradle to versionName "${targetVersionStr}" and versionCode ${versionCode}`);
        filesToStage.push('android/app/build.gradle');
    } else {
        console.error("Could not find versionCode or versionName patterns in build.gradle. Please check the file manually.");
    }
} else {
    console.warn("Android build.gradle not found. Skipping Android update.");
}

// 4. Update index.html
if (fs.existsSync(INDEX_HTML_PATH)) {
    let indexContent = fs.readFileSync(INDEX_HTML_PATH, 'utf8');
    // Regex to match vX.Y.Z (e.g. v1.2.0)
    const versionRegex = /v\d+\.\d+\.\d+/g;

    if (versionRegex.test(indexContent)) {
        indexContent = indexContent.replace(versionRegex, `v${targetVersionStr}`);
        fs.writeFileSync(INDEX_HTML_PATH, indexContent);
        console.log(`Updated index.html to v${targetVersionStr}`);
        filesToStage.push('index.html');
    } else {
        console.warn("Could not find version pattern (vX.Y.Z) in index.html");
    }
}

// 4. Git Tag & Commit (Optional)
if (shouldGitTag) {
    console.log('Creating git release...');
    try {
        // Stage files
        const filesString = filesToStage.join(' ');

        console.log(`Staging: ${filesString}`);
        execSync(`git add ${filesString}`);

        const commitMsg = `Release v${targetVersionStr}`;
        console.log(`Committing: "${commitMsg}"`);
        execSync(`git commit -m "${commitMsg}"`);

        const tagName = `v${targetVersionStr}`;
        console.log(`Tagging: ${tagName}`);
        execSync(`git tag ${tagName}`);

        console.log(`\n\u2705 Release ${tagName} created!`);
        console.log(`Don't forget to push: git push && git push origin ${tagName}`);
    } catch (error) {
        console.error('Error creating git release:', error.message);
        // Don't exit with error code if we just want to warn, but release creation failure is probably error worthy
        process.exit(1);
    }
}

console.log("Version update complete. \u2705");
