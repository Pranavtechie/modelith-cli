import React, { useEffect, useState, lazy, Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import type { NotebookContent } from '@frontend/lib/notebook-schemas';

// Dynamic imports for heavy dependencies
const MarkdownPreview = lazy(() => import('@uiw/react-markdown-preview'));
const SyntaxHighlighterModule = lazy(() => 
  import('react-syntax-highlighter').then(module => ({ 
    default: module.Prism 
  }))
);
const tomorrowStylePromise = import('react-syntax-highlighter/dist/esm/styles/prism').then(module => module.tomorrow);

interface NotebookViewerProps {
  notebookContent: NotebookContent | null;
  title: string;
  studentName: string;
}

/**
 * A component that renders a Jupyter notebook
 */
const NotebookViewer: React.FC<NotebookViewerProps> = ({ notebookContent, title, studentName }) => {
  const [sampleNotebook, setSampleNotebook] = useState<NotebookContent | null>(null);

  // Only create a sample notebook if we don't have content after a delay
  useEffect(() => {
    // Don't show sample content if we have real content
    if (notebookContent) {
      setSampleNotebook(null);
      return;
    }
    
    // Wait a moment before showing sample content to give real content a chance to load
    const timer = setTimeout(() => {
      if (!notebookContent) {
        console.log("No real notebook content, showing sample");
        const defaultNotebook = {
          cells: [
            {
              cell_type: "markdown",
              source: "# Sample Notebook\n\nThis is a placeholder notebook.",
              metadata: {}
            },
            {
              cell_type: "code",
              source: "print('Hello, world!')",
              metadata: {},
              execution_count: 1,
              outputs: [
                {
                  output_type: "stream",
                  name: "stdout",
                  text: "Hello, world!\n"
                }
              ]
            }
          ],
          metadata: {},
          nbformat: 4,
          nbformat_minor: 5
        };
        
        setSampleNotebook(defaultNotebook as NotebookContent);
      }
    }, 1000); // Wait 1 second
    
    return () => clearTimeout(timer);
  }, [notebookContent]);

  // Get the notebook to display (real data or sample)
  const displayNotebook = notebookContent || sampleNotebook;

  // Render markdown cell
  const renderMarkdownCell = (source: string | string[], index: number) => {
    const content = Array.isArray(source) ? source.join('') : source;
    return (
      <div key={`md-${index}`} className="notebook-cell markdown-cell">
        <div className="cell-content markdown-content">
          <Suspense fallback={<div className="p-2 bg-gray-100">Loading markdown...</div>}>
            <MarkdownPreview source={content} />
          </Suspense>
        </div>
      </div>
    );
  };

  // State to store the loaded style
  const [tomorrowStyle, setTomorrowStyle] = useState<any>(null);
  
  // Load the style when the component mounts
  useEffect(() => {
    tomorrowStylePromise.then(style => setTomorrowStyle(style));
  }, []);

  // Render code cell
  const renderCodeCell = (cell: any, index: number) => {
    // Ensure we're working with a string for source content
    const source = Array.isArray(cell.source) ? cell.source.join('') : 
                  typeof cell.source === 'string' ? cell.source : 
                  JSON.stringify(cell.source, null, 2);
                  
    console.log(`Rendering code cell ${index}:`, cell);
    
    return (
      <div key={`code-${index}`} className="notebook-cell code-cell">
        <div className="cell-number">[{cell.execution_count ?? ' '}]:</div>
        <div className="cell-content code-content">
          <Suspense fallback={<div className="p-2 bg-gray-100">Loading code highlighting...</div>}>
            {tomorrowStyle ? (
              <SyntaxHighlighterModule 
                language="python" 
                style={tomorrowStyle}
                customStyle={{ margin: 0, padding: '1rem', borderRadius: 0 }}
              >
                {source}
              </SyntaxHighlighterModule>
            ) : (
              <pre className="p-3 bg-gray-800 text-white">{source}</pre>
            )}
          </Suspense>
        </div>
        
        {/* Display cell ID if available */}
        {cell.id && (
          <div className="cell-id text-xs text-gray-400 px-2">ID: {cell.id}</div>
        )}
        
        {/* Render outputs */}
        {cell.outputs && cell.outputs.length > 0 && (
          <div className="cell-outputs">
            {cell.outputs.map((output: any, outputIndex: number) => {
              // Text output (stream)
              if (output.output_type === 'stream') {
                const text = Array.isArray(output.text) ? output.text.join('') : 
                            typeof output.text === 'string' ? output.text : '';
                return (
                  <pre key={`output-${outputIndex}`} className="stream-output">
                    {text}
                  </pre>
                );
              }
              
              // Execute result or display data
              if (output.output_type === 'execute_result' || output.output_type === 'display_data') {
                return (
                  <div key={`output-${outputIndex}`}>
                    {/* Plain text output */}
                    {output.data && output.data['text/plain'] && (
                      <pre className="plain-output">
                        {Array.isArray(output.data['text/plain'])
                          ? output.data['text/plain'].join('')
                          : output.data['text/plain']}
                      </pre>
                    )}
                    
                    {/* HTML output */}
                    {output.data && output.data['text/html'] && (
                      <div 
                        className="html-output"
                        dangerouslySetInnerHTML={{
                          __html: Array.isArray(output.data['text/html'])
                            ? output.data['text/html'].join('')
                            : output.data['text/html']
                        }}
                      />
                    )}
                    
                    {/* Image output */}
                    {output.data && output.data['image/png'] && (
                      <img
                        src={`data:image/png;base64,${output.data['image/png']}`}
                        alt="Output visualization"
                        className="image-output"
                      />
                    )}
                  </div>
                );
              }
              
              // Error output
              if (output.output_type === 'error') {
                return (
                  <pre key={`output-${outputIndex}`} className="error-output">
                    {output.traceback
                      ? (Array.isArray(output.traceback)
                        ? output.traceback.join('\n')
                        : output.traceback)
                      : (output.ename && output.evalue
                        ? `${output.ename}: ${output.evalue}`
                        : 'Unknown error')}
                  </pre>
                );
              }
              
              return null;
            })}
          </div>
        )}
      </div>
    );
  };

  // Main render function for the notebook with more detailed output for debugging
  console.log("Current notebook content:", displayNotebook);
  const renderNotebook = () => {
    if (!displayNotebook) return null;

    return displayNotebook.cells.map((cell, index) => {
      if (cell.cell_type === 'markdown') {
        return renderMarkdownCell(cell.source, index);
      } else if (cell.cell_type === 'code') {
        return renderCodeCell(cell, index);
      }
      return null;
    });
  };

  // Display placeholder if no content
  if (!displayNotebook) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>No notebook data available for {studentName}</CardDescription>
        </CardHeader>
        <CardContent className="h-[600px] flex items-center justify-center bg-gray-50">
          <p className="text-gray-500 text-center">
            Notebook data not available
          </p>
        </CardContent>
      </Card>
    );
  }

  // Normal content render with notebook
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          Notebook for {studentName} - {displayNotebook.cells.length} cells
          {!notebookContent && <span className="ml-2 text-red-500">(Sample Data)</span>}
        </CardDescription>
      </CardHeader>
      <CardContent className="max-h-[600px] overflow-auto">
        <div className="jupyter-notebook">
          <div className="notebook-container">
            {renderNotebook()}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default NotebookViewer;