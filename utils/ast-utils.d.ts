import { ProjectGraphProjectNode } from '@nrwl/devkit';
/**
 *
 * @param importScope like `@myorg/somelib`
 * @returns
 */
export declare function getBarrelEntryPointByImportScope(importScope: string): string[] | null;
export declare function getBarrelEntryPointProjectNode(projectNode: ProjectGraphProjectNode<any>): {
    path: string;
    importScope: string;
}[] | null;
export declare function getRelativeImportPath(exportedMember: any, filePath: any, basePath: any): any;
