import { z } from 'zod';

// Basic cell schemas
export const notebookCellOutputSchema = z.object({
  output_type: z.string().optional(),
  data: z.record(z.any()).optional(),
  text: z.union([z.string(), z.array(z.string())]).optional(),
  execution_count: z.number().nullable().optional(),
  metadata: z.record(z.any()).optional(),
}).passthrough();

export const notebookCellSchema = z.object({
  cell_type: z.string(),
  source: z.union([z.string(), z.array(z.string())]),
  metadata: z.record(z.any()).optional(),
  execution_count: z.number().nullable().optional(),
  outputs: z.array(notebookCellOutputSchema).optional(),
}).passthrough();

// Main notebook schema
export const notebookSchema = z.object({
  cells: z.array(notebookCellSchema),
  metadata: z.record(z.any()),
  nbformat: z.number(),
  nbformat_minor: z.number(),
}).passthrough();

// ExifTool metadata schemas
export const exifToolMetadataSchema = z.object({
  FileType: z.string().optional(),
  MIMEType: z.string().optional(),
  JSON: z.union([
    z.string(),
    notebookSchema
  ]).optional(),
}).passthrough();

// Helper functions to extract and validate notebook content
export const extractAndValidateNotebook = (metadataJson: unknown): z.infer<typeof notebookSchema> | null => {
  try {
    console.log("Extracting notebook from metadata");
    
    // If metadataJson is null or undefined
    if (!metadataJson) {
      console.log("No metadata provided");
      return null;
    }

    if (typeof metadataJson === 'object' && metadataJson !== null) {
      const data = metadataJson as any;

      // Based on the complete JSON Schema, we need to look for the specific structure:
      // The notebook data in the ExifTool metadata has Cells, Metadata, Nbformat, Nbformat_minor fields
      
      // Check for the exact match to the ExifTool metadata structure
      if (data.Cells && Array.isArray(data.Cells) && data.Metadata && data.Nbformat !== undefined) {
        console.log("Found ExifTool metadata structure with Cells array");
        
        // Construct a proper Jupyter notebook from the ExifTool metadata
        const notebook = {
          cells: data.Cells.map((cell: any) => ({
            cell_type: cell.cell_type,
            source: cell.source || '',
            metadata: cell.metadata || {},
            execution_count: cell.execution_count !== undefined ? cell.execution_count : null,
            outputs: cell.outputs || []
          })),
          metadata: data.Metadata || {},
          nbformat: data.Nbformat || 4,
          nbformat_minor: data.Nbformat_minor || 5
        };
        
        console.log("Successfully constructed notebook from ExifTool data");
        return notebook as z.infer<typeof notebookSchema>;
      }
      
      // Also check for lowercase field names
      if (data.cells && Array.isArray(data.cells) && data.metadata && data.nbformat !== undefined) {
        console.log("Found standard notebook structure with 'cells' array");
        
        // This is already a standard notebook format
        return data as z.infer<typeof notebookSchema>;
      }
      
      // Check for cells array as a direct property (which might happen in some variants)
      if (data.Cells && Array.isArray(data.Cells)) {
        console.log("Found Cells array without full metadata structure");
        
        // Try to construct a valid notebook from just the cells array
        const notebook = {
          cells: data.Cells.map((cell: any) => ({
            cell_type: cell.cell_type || 'code',
            source: cell.source || '',
            metadata: cell.metadata || {},
            execution_count: cell.execution_count !== undefined ? cell.execution_count : null,
            outputs: cell.outputs || []
          })),
          metadata: {},
          nbformat: 4,
          nbformat_minor: 5
        };
        
        console.log("Constructed notebook from Cells array only");
        return notebook as z.infer<typeof notebookSchema>;
      }
      
      // As a last resort, try to look for numbered properties that resemble cells
      const cells: any[] = [];
      
      // Iterate through the properties to find numeric indices
      for (let i = 0; i < 25; i++) {
        if (data[i] && typeof data[i] === 'object' && data[i].cell_type) {
          console.log(`Found cell at index ${i}`);
          cells.push({
            cell_type: data[i].cell_type,
            source: data[i].source || '',
            metadata: data[i].metadata || {},
            execution_count: data[i].execution_count !== undefined ? data[i].execution_count : i,
            outputs: data[i].outputs || []
          });
        }
      }
      
      if (cells.length > 0) {
        console.log(`Constructed notebook from ${cells.length} indexed cells`);
        return {
          cells,
          metadata: {},
          nbformat: 4,
          nbformat_minor: 5
        } as z.infer<typeof notebookSchema>;
      }
    }

    console.log("No valid notebook structure found in metadata");
    return null;
  } catch (error) {
    console.error("Error extracting notebook content:", error);
    return null;
  }
};

// Types derived from the schemas
export type NotebookCell = z.infer<typeof notebookCellSchema>;
export type NotebookContent = z.infer<typeof notebookSchema>;