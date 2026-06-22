import fs from 'fs';
import path from 'path';

const processingPath = path.resolve('src/pages/Processing/ProcessingModule.jsx');
const managementPath = path.resolve('src/pages/Orders/Management.jsx');

// 1. Fix ProcessingModule.jsx
let procContent = fs.readFileSync(processingPath, 'utf8');

// Regex to match the isGreigeRollMatch function declaration globally
const matchFnRegex = /const\s+isGreigeRollMatch\s*=\s*\([^)]*\)\s*=>\s*\{[^}]*return\s+\([^)]*\);\s*\};/g;

// Strip all declarations of isGreigeRollMatch
procContent = procContent.replace(matchFnRegex, '');

// Strip any left-over duplicate declarations if any
const simpleRegex = /const\s+isGreigeRollMatch\s*=\s*[\s\S]*?\n\};/g;
procContent = procContent.replace(simpleRegex, '');

// Also let's clean the const PROCESS_OPTIONS match
procContent = procContent.replace('const PROCESS_OPTIONS = [', `const isGreigeRollMatch = (rxGreigeRollId, sentRollId) => {
  if (!rxGreigeRollId || !sentRollId) return false;
  const rxLower = rxGreigeRollId.toLowerCase();
  const sentLower = sentRollId.toLowerCase();
  return (
    rxLower === sentLower ||
    sentLower.startsWith(rxLower + '/') ||
    rxLower.startsWith(sentLower + '/')
  );
};

const PROCESS_OPTIONS = [`);

fs.writeFileSync(processingPath, procContent, 'utf8');
console.log('Cleaned ProcessingModule.jsx');

// 2. Fix Management.jsx
let mgmtContent = fs.readFileSync(managementPath, 'utf8');

// Strip all declarations of isGreigeRollMatch
mgmtContent = mgmtContent.replace(matchFnRegex, '');
mgmtContent = mgmtContent.replace(simpleRegex, '');

// Insert it cleanly
mgmtContent = mgmtContent.replace('const getTodayString = () => {', `const isGreigeRollMatch = (rxGreigeRollId, sentRollId) => {
  if (!rxGreigeRollId || !sentRollId) return false;
  const rxLower = rxGreigeRollId.toLowerCase();
  const sentLower = sentRollId.toLowerCase();
  return (
    rxLower === sentLower ||
    sentLower.startsWith(rxLower + '/') ||
    rxLower.startsWith(sentLower + '/')
  );
};

const getTodayString = () => {`);

fs.writeFileSync(managementPath, mgmtContent, 'utf8');
console.log('Cleaned Management.jsx');
