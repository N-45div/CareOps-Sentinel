import sampleInput from "./fixtures/sampleValidationInput.json" with { type: "json" };
import { validateAgentOutput } from "./domain/safetyEngine.js";
import { validationInputSchema } from "./mcp/schemas.js";

const result = validateAgentOutput(validationInputSchema.parse(sampleInput));

console.log(JSON.stringify(result, null, 2));
