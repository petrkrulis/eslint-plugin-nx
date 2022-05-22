"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const enforce_module_boundaries_1 = require("./rules/enforce-module-boundaries");
// Resolve any custom rules that might exist in the current workspace
const resolve_workspace_rules_1 = require("./resolve-workspace-rules");
module.exports = {
    rules: Object.assign({ [enforce_module_boundaries_1.RULE_NAME]: enforce_module_boundaries_1.default }, resolve_workspace_rules_1.workspaceRules),
};
//# sourceMappingURL=index.js.map
