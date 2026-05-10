const fs = require("node:fs");
const path = require("node:path");

const distDir = path.join(process.cwd(), "dist");
const vercelFunctionsDir = path.join(process.cwd(), ".vercel", "output", "functions");
const commonJsPackage = JSON.stringify({ type: "commonjs" }, null, 2) + "\n";
const initializeCapabilitiesNeedle = "capabilities:this.getCapabilities(),serverInfo:this._serverInfo";
const promptOpinionFhirExtension = {
  "ai.promptopinion/fhir-context": {
    scopes: [
      { name: "patient/Patient.rs", required: true },
      { name: "patient/Condition.rs" },
      { name: "patient/MedicationRequest.rs" },
      { name: "patient/MedicationStatement.rs" },
      { name: "patient/Observation.rs" },
      { name: "patient/AllergyIntolerance.rs" },
      { name: "patient/Encounter.rs" },
      { name: "patient/Procedure.rs" },
      { name: "patient/CarePlan.rs" },
      { name: "patient/ServiceRequest.rs" }
    ],
    headers: {
      fhirBaseUrl: "X-FHIR-Server-URL",
      accessToken: "X-FHIR-Access-Token",
      patientId: "X-Patient-ID"
    }
  }
};

if (fs.existsSync(distDir)) {
  fs.writeFileSync(path.join(distDir, "package.json"), commonJsPackage);
  patchInitializeCapabilities(path.join(distDir, "http.js"));
}

function writeVercelFunctionPackages(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);

    if (!entry.isDirectory()) {
      continue;
    }

    if (entry.name.endsWith(".func")) {
      fs.writeFileSync(path.join(entryPath, "package.json"), commonJsPackage);
      patchInitializeCapabilities(path.join(entryPath, "index.js"));
      continue;
    }

    writeVercelFunctionPackages(entryPath);
  }
}

if (fs.existsSync(vercelFunctionsDir)) {
  writeVercelFunctionPackages(vercelFunctionsDir);
}

function patchInitializeCapabilities(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const source = fs.readFileSync(filePath, "utf8");
  if (source.includes("ai.promptopinion/fhir-context")) {
    return;
  }

  const replacement = `capabilities:{...this.getCapabilities(),extensions:${JSON.stringify(promptOpinionFhirExtension)}},serverInfo:this._serverInfo`;
  if (!source.includes(initializeCapabilitiesNeedle)) {
    throw new Error(`Unable to patch Prompt Opinion FHIR extension into ${filePath}`);
  }

  fs.writeFileSync(filePath, source.replace(initializeCapabilitiesNeedle, replacement));
}
