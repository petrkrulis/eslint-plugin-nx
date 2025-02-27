"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateVersionJsonExpression = exports.validatePackageGroup = exports.validateImplemenationNode = exports.validateEntry = exports.checkCollectionNode = exports.checkCollectionFileNode = exports.RULE_NAME = void 0;
const app_root_1 = require("@nrwl/devkit");
const devkit_1 = require("@nrwl/devkit");
const runtime_lint_utils_1 = require("@nrwl/workspace/src/utils/runtime-lint-utils");
const fs_1 = require("fs");
const register_1 = require("nx/src/utils/register");
const path = require("path");
const create_eslint_rule_1 = require("../utils/create-eslint-rule");
const project_graph_utils_1 = require("../utils/project-graph-utils");
const semver_1 = require("semver");
const DEFAULT_OPTIONS = {
    generatorsJson: 'generators.json',
    executorsJson: 'executors.json',
    migrationsJson: 'migrations.json',
    packageJson: 'package.json',
    allowedVersionStrings: ['*', 'latest', 'next'],
};
exports.RULE_NAME = 'nx-plugin-checks';
exports.default = (0, create_eslint_rule_1.createESLintRule)({
    name: exports.RULE_NAME,
    meta: {
        docs: {
            description: 'Checks common nx-plugin configuration files for validity',
            recommended: 'error',
        },
        schema: {},
        type: 'problem',
        messages: {
            invalidSchemaPath: 'Schema path should point to a valid file',
            invalidImplementationPath: '{{ key }}: Implementation path should point to a valid file',
            invalidImplementationModule: '{{ key }}: Unable to find export {{ identifier }} in implementation module',
            unableToReadImplementationExports: '{{ key }}: Unable to read exports for implementation module',
            invalidVersion: '{{ key }}: Version should be a valid semver',
            noGeneratorsOrSchematicsFound: 'Unable to find `generators` or `schematics` property',
            noExecutorsOrBuildersFound: 'Unable to find `executors` or `builders` property',
            valueShouldBeObject: '{{ key }} should be an object',
            missingRequiredSchema: '{{ key }}: Missing required property - `schema`',
            missingImplementation: '{{ key }}: Missing required property - `implementation`',
            missingVersion: '{{ key }}: Missing required property - `version`',
        },
    },
    defaultOptions: [DEFAULT_OPTIONS],
    create(context) {
        // jsonc-eslint-parser adds this property to parserServices where appropriate
        if (!context.parserServices.isJSON) {
            return {};
        }
        const projectGraph = (0, project_graph_utils_1.readProjectGraph)(exports.RULE_NAME);
        const sourceFilePath = (0, runtime_lint_utils_1.getSourceFilePath)(context.getFilename(), devkit_1.workspaceRoot || app_root_1.appRootPath);
        const sourceProject = (0, runtime_lint_utils_1.findSourceProject)(projectGraph, sourceFilePath);
        // If source is not part of an nx workspace, return.
        if (!sourceProject) {
            return {};
        }
        const options = normalizeOptions(sourceProject, context.options[0]);
        context.options[0] = options;
        const { generatorsJson, executorsJson, migrationsJson, packageJson } = options;
        if (![generatorsJson, executorsJson, migrationsJson, packageJson].includes(sourceFilePath)) {
            return {};
        }
        if (!global.tsProjectRegistered) {
            (0, register_1.registerTsProject)(devkit_1.workspaceRoot || app_root_1.appRootPath, 'tsconfig.base.json');
            global.tsProjectRegistered = true;
        }
        return {
            ['JSONExpressionStatement > JSONObjectExpression'](node) {
                if (sourceFilePath === generatorsJson) {
                    checkCollectionFileNode(node, 'generator', context);
                }
                else if (sourceFilePath === migrationsJson) {
                    checkCollectionFileNode(node, 'migration', context);
                }
                else if (sourceFilePath === executorsJson) {
                    checkCollectionFileNode(node, 'executor', context);
                }
                else if (sourceFilePath === packageJson) {
                    validatePackageGroup(node, context);
                }
            },
        };
    },
});
function normalizeOptions(sourceProject, options) {
    const base = Object.assign(Object.assign({}, DEFAULT_OPTIONS), options);
    return Object.assign(Object.assign({}, base), { executorsJson: base.executorsJson
            ? `${sourceProject.data.root}/${base.executorsJson}`
            : undefined, generatorsJson: base.generatorsJson
            ? `${sourceProject.data.root}/${base.generatorsJson}`
            : undefined, migrationsJson: base.migrationsJson
            ? `${sourceProject.data.root}/${base.migrationsJson}`
            : undefined, packageJson: base.packageJson
            ? `${sourceProject.data.root}/${base.packageJson}`
            : undefined });
}
function checkCollectionFileNode(baseNode, mode, context) {
    const schematicsRootNode = baseNode.properties.find((x) => x.key.type === 'JSONLiteral' && x.key.value === 'schematics');
    const generatorsRootNode = baseNode.properties.find((x) => x.key.type === 'JSONLiteral' && x.key.value === 'generators');
    const executorsRootNode = baseNode.properties.find((x) => x.key.type === 'JSONLiteral' && x.key.value === 'executors');
    const buildersRootNode = baseNode.properties.find((x) => x.key.type === 'JSONLiteral' && x.key.value === 'builders');
    if (!schematicsRootNode && !generatorsRootNode && mode !== 'executor') {
        context.report({
            messageId: 'noGeneratorsOrSchematicsFound',
            node: baseNode,
        });
        return;
    }
    if (!executorsRootNode && !buildersRootNode && mode === 'executor') {
        context.report({
            messageId: 'noExecutorsOrBuildersFound',
            node: baseNode,
        });
        return;
    }
    const collectionNodes = [
        { collectionNode: schematicsRootNode, key: 'schematics' },
        { collectionNode: generatorsRootNode, key: 'generators' },
        { collectionNode: executorsRootNode, key: 'executors' },
        { collectionNode: buildersRootNode, key: 'builders' },
    ].filter(({ collectionNode }) => !!collectionNode);
    for (const { collectionNode, key } of collectionNodes) {
        if (collectionNode.value.type !== 'JSONObjectExpression') {
            context.report({
                messageId: 'valueShouldBeObject',
                data: { key },
                node: schematicsRootNode,
            });
        }
        else {
            checkCollectionNode(collectionNode.value, mode, context);
        }
    }
}
exports.checkCollectionFileNode = checkCollectionFileNode;
function checkCollectionNode(baseNode, mode, context) {
    const entries = baseNode.properties;
    for (const entryNode of entries) {
        if (entryNode.value.type !== 'JSONObjectExpression') {
            context.report({
                messageId: 'valueShouldBeObject',
                data: { key: entryNode.key.value },
                node: entryNode,
            });
        }
        else if (entryNode.key.type === 'JSONLiteral') {
            validateEntry(entryNode.value, entryNode.key.value.toString(), mode, context);
        }
    }
}
exports.checkCollectionNode = checkCollectionNode;
function validateEntry(baseNode, key, mode, context) {
    const schemaNode = baseNode.properties.find((x) => x.key.type === 'JSONLiteral' && x.key.value === 'schema');
    if (mode !== 'migration' && !schemaNode) {
        context.report({
            messageId: 'missingRequiredSchema',
            data: {
                key,
            },
            node: baseNode,
        });
    }
    else if (schemaNode) {
        if (schemaNode.value.type !== 'JSONLiteral' ||
            typeof schemaNode.value.value !== 'string') {
            context.report({
                messageId: 'invalidSchemaPath',
                node: schemaNode.value,
            });
        }
        else {
            const schemaFilePath = path.join(path.dirname(context.getFilename()), schemaNode.value.value);
            if (!(0, fs_1.existsSync)(schemaFilePath)) {
                context.report({
                    messageId: 'invalidSchemaPath',
                    node: schemaNode.value,
                });
            }
            else {
                try {
                    (0, devkit_1.readJsonFile)(schemaFilePath);
                }
                catch (e) {
                    context.report({
                        messageId: 'invalidSchemaPath',
                        node: schemaNode.value,
                    });
                }
            }
        }
    }
    const implementationNode = baseNode.properties.find((x) => x.key.type === 'JSONLiteral' &&
        (x.key.value === 'implementation' || x.key.value === 'factory'));
    if (!implementationNode) {
        context.report({
            messageId: 'missingImplementation',
            data: {
                key,
            },
            node: baseNode,
        });
    }
    else {
        validateImplemenationNode(implementationNode, key, context);
    }
    if (mode === 'migration') {
        const versionNode = baseNode.properties.find((x) => x.key.type === 'JSONLiteral' && x.key.value === 'version');
        if (!versionNode) {
            context.report({
                messageId: 'missingVersion',
                data: {
                    key,
                },
                node: baseNode,
            });
        }
        else if (versionNode.value.type !== 'JSONLiteral' ||
            typeof versionNode.value.value !== 'string') {
            context.report({
                messageId: 'invalidVersion',
                data: {
                    key,
                },
                node: versionNode.value,
            });
        }
        else {
            const specifiedVersion = versionNode.value.value;
            if (!(0, semver_1.valid)(specifiedVersion)) {
                context.report({
                    messageId: 'invalidVersion',
                    data: {
                        key,
                    },
                    node: versionNode.value,
                });
            }
        }
    }
}
exports.validateEntry = validateEntry;
function validateImplemenationNode(implementationNode, key, context) {
    if (implementationNode.value.type !== 'JSONLiteral' ||
        typeof implementationNode.value.value !== 'string') {
        context.report({
            messageId: 'invalidImplementationPath',
            data: {
                key,
            },
            node: implementationNode.value,
        });
    }
    else {
        const [implementationPath, identifier] = implementationNode.value.value.split('#');
        let resolvedPath;
        const modulePath = path.join(path.dirname(context.getFilename()), implementationPath);
        try {
            resolvedPath = require.resolve(modulePath);
        }
        catch (e) {
            context.report({
                messageId: 'invalidImplementationPath',
                data: {
                    key,
                },
                node: implementationNode.value,
            });
        }
        if (identifier) {
            try {
                const m = require(resolvedPath);
                if (!(identifier in m && typeof m[identifier] === 'function')) {
                    context.report({
                        messageId: 'invalidImplementationModule',
                        node: implementationNode.value,
                        data: {
                            identifier,
                            key,
                        },
                    });
                }
            }
            catch (_a) {
                context.report({
                    messageId: 'unableToReadImplementationExports',
                    node: implementationNode.value,
                    data: {
                        key,
                    },
                });
            }
        }
    }
}
exports.validateImplemenationNode = validateImplemenationNode;
function validatePackageGroup(baseNode, context) {
    var _a, _b, _c;
    const migrationsNode = (_a = baseNode.properties.find((x) => x.key.type === 'JSONLiteral' &&
        x.value.type === 'JSONObjectExpression' &&
        (x.key.value === 'nx-migrations' ||
            x.key.value === 'ng-update' ||
            x.key.value === 'migrations'))) === null || _a === void 0 ? void 0 : _a.value;
    const packageGroupNode = migrationsNode === null || migrationsNode === void 0 ? void 0 : migrationsNode.properties.find((x) => x.key.type === 'JSONLiteral' && x.key.value === 'packageGroup');
    if (packageGroupNode) {
        // Package group is defined as an array
        if (packageGroupNode.value.type === 'JSONArrayExpression') {
            // Look at entries which are an object
            const members = packageGroupNode.value.elements.filter((x) => x.type === 'JSONObjectExpression');
            // validate that the version property exists and is valid
            for (const member of members) {
                const versionPropertyNode = member.properties.find((x) => x.key.type === 'JSONLiteral' && x.key.value === 'version');
                const packageNode = member.properties.find((x) => x.key.type === 'JSONLiteral' && x.key.value === 'package');
                const key = (_c = (_b = packageNode === null || packageNode === void 0 ? void 0 : packageNode.value) === null || _b === void 0 ? void 0 : _b.value) !== null && _c !== void 0 ? _c : 'unknown';
                if (versionPropertyNode) {
                    if (!validateVersionJsonExpression(versionPropertyNode.value, context))
                        context.report({
                            messageId: 'invalidVersion',
                            data: { key },
                            node: versionPropertyNode.value,
                        });
                }
                else {
                    context.report({
                        messageId: 'missingVersion',
                        data: { key },
                        node: member,
                    });
                }
            }
            // Package group is defined as an object (Record<PackageName, Version>)
        }
        else if (packageGroupNode.value.type === 'JSONObjectExpression') {
            const properties = packageGroupNode.value.properties;
            // For each property, ensure its value is a valid version
            for (const propertyNode of properties) {
                if (!validateVersionJsonExpression(propertyNode.value, context)) {
                    context.report({
                        messageId: 'invalidVersion',
                        data: {
                            key: propertyNode.key.value,
                        },
                        node: propertyNode.value,
                    });
                }
            }
        }
    }
}
exports.validatePackageGroup = validatePackageGroup;
function validateVersionJsonExpression(node, context) {
    var _a;
    return (node &&
        node.type === 'JSONLiteral' &&
        typeof node.value === 'string' &&
        ((0, semver_1.valid)(node.value) ||
            ((_a = context.options[0]) === null || _a === void 0 ? void 0 : _a.allowedVersionStrings.includes(node.value))));
}
exports.validateVersionJsonExpression = validateVersionJsonExpression;
//# sourceMappingURL=nx-plugin-checks.js.map
