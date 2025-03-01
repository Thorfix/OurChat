import React, { useState } from 'react';
import styled from 'styled-components';
import { FaQuestionCircle, FaTimes } from 'react-icons/fa';

const GuideButton = styled.button`
  background: none;
  border: none;
  color: var(--secondary-color);
  cursor: pointer;
  font-size: 0.8rem;
  margin-left: 0.5rem;
  display: flex;
  align-items: center;
  
  svg {
    margin-right: 0.3rem;
  }
`;

const GuideContainer = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
`;

const GuideContent = styled.div`
  background-color: var(--background-color);
  border: 2px solid var(--primary-color);
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  padding: 1.5rem;
  position: relative;
`;

const CloseButton = styled.button`
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: none;
  border: none;
  color: var(--secondary-color);
  cursor: pointer;
  font-size: 1.2rem;
`;

const GuideTitle = styled.h2`
  color: var(--primary-color);
  margin-top: 0;
  margin-bottom: 1rem;
  font-family: var(--font-header);
  border-bottom: 1px solid var(--primary-color);
  padding-bottom: 0.5rem;
`;

const SyntaxTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 1.5rem;
  
  th, td {
    border: 1px solid var(--primary-color);
    padding: 0.5rem;
    text-align: left;
  }
  
  th {
    background-color: rgba(0, 0, 0, 0.3);
    color: var(--secondary-color);
  }
  
  code {
    background-color: rgba(0, 0, 0, 0.5);
    padding: 0.1rem 0.3rem;
    border-radius: 3px;
    font-family: monospace;
  }
`;

const MarkdownGuide = () => {
  const [showGuide, setShowGuide] = useState(false);
  
  return (
    <>
      <GuideButton onClick={() => setShowGuide(true)}>
        <FaQuestionCircle />
        Markdown Help
      </GuideButton>
      
      {showGuide && (
        <GuideContainer>
          <GuideContent>
            <CloseButton onClick={() => setShowGuide(false)}>
              <FaTimes />
            </CloseButton>
            
            <GuideTitle>Markdown Syntax Guide</GuideTitle>
            
            <p>RetroChat supports the following Markdown syntax for formatting your messages:</p>
            
            <SyntaxTable>
              <thead>
                <tr>
                  <th>Format</th>
                  <th>Syntax</th>
                  <th>Example</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Bold</td>
                  <td><code>**text**</code></td>
                  <td><strong>bold text</strong></td>
                </tr>
                <tr>
                  <td>Italic</td>
                  <td><code>*text*</code></td>
                  <td><em>italic text</em></td>
                </tr>
                <tr>
                  <td>Link</td>
                  <td><code>[title](url)</code></td>
                  <td><a href="#">link text</a></td>
                </tr>
                <tr>
                  <td>Inline Code</td>
                  <td><code>`code`</code></td>
                  <td><code>inline code</code></td>
                </tr>
                <tr>
                  <td>Code Block</td>
                  <td><code>```<br />code block<br />```</code></td>
                  <td>Code block with syntax highlighting</td>
                </tr>
                <tr>
                  <td>Unordered List</td>
                  <td><code>- item 1<br />- item 2</code></td>
                  <td>
                    <ul style={{ marginTop: 0, marginBottom: 0 }}>
                      <li>item 1</li>
                      <li>item 2</li>
                    </ul>
                  </td>
                </tr>
                <tr>
                  <td>Blockquote</td>
                  <td><code>&gt; quoted text</code></td>
                  <td style={{ borderLeft: '3px solid grey', paddingLeft: '10px' }}>quoted text</td>
                </tr>
              </tbody>
            </SyntaxTable>
            
            <p>Click the formatting buttons above the message input to automatically insert the appropriate markdown syntax.</p>
            
            <p>You can preview your formatted message before sending by clicking the "Show Markdown Preview" button.</p>
          </GuideContent>
        </GuideContainer>
      )}
    </>
  );
};

export default MarkdownGuide;