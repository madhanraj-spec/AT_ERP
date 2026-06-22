import fs from 'fs';
import path from 'path';

const processingPath = path.resolve('src/pages/Processing/ProcessingModule.jsx');
const managementPath = path.resolve('src/pages/Orders/Management.jsx');

// Helper function to define at top of files
const helperCode = `const isGreigeRollMatch = (rxGreigeRollId, sentRollId) => {
  if (!rxGreigeRollId || !sentRollId) return false;
  const rxLower = rxGreigeRollId.toLowerCase();
  const sentLower = sentRollId.toLowerCase();
  return (
    rxLower === sentLower ||
    sentLower.startsWith(rxLower + '/') ||
    rxLower.startsWith(sentLower + '/')
  );
};

const PROCESS_OPTIONS = [`;

// 1. Update ProcessingModule.jsx
let procContent = fs.readFileSync(processingPath, 'utf8');

// Define helper
procContent = procContent.replace('const PROCESS_OPTIONS = [', helperCode);

// Replace match 1
procContent = procContent.replace(
  'const remainingRolls = sentRolls.filter(r => !receivedRollsList.some(rx => rx.greige_roll_id === r.id));',
  'const remainingRolls = sentRolls.filter(r => !receivedRollsList.some(rx => isGreigeRollMatch(rx.greige_roll_id, r.id)));'
);

// Replace match 2 (the second occurrence)
procContent = procContent.replace(
  'const remainingRolls = sentRolls.filter(r => !receivedRollsList.some(rx => rx.greige_roll_id === r.id));',
  'const remainingRolls = sentRolls.filter(r => !receivedRollsList.some(rx => isGreigeRollMatch(rx.greige_roll_id, r.id)));'
);

// Replace match 3
procContent = procContent.replace(
  'const rxRoll = editPofReceivedRolls.find(rx => rx.greige_roll_id === r.id);',
  'const rxRoll = editPofReceivedRolls.find(rx => isGreigeRollMatch(rx.greige_roll_id, r.id));'
);

// Replace match 4
procContent = procContent.replace(
  `const rxRolls = Array.isArray(pof.received_rolls) \n                                                ? pof.received_rolls.filter(rx => rx.greige_roll_id === roll.id) \n                                                : [];`,
  `const rxRolls = Array.isArray(pof.received_rolls) \n                                                ? pof.received_rolls.filter(rx => isGreigeRollMatch(rx.greige_roll_id, roll.id)) \n                                                : [];`
);
// Fallback if formatting was different
procContent = procContent.replace(
  'pof.received_rolls.filter(rx => rx.greige_roll_id === roll.id)',
  'pof.received_rolls.filter(rx => isGreigeRollMatch(rx.greige_roll_id, roll.id))'
);

// Replace match 5
procContent = procContent.replace(
  'selectedPof.received_rolls.some(rx => rx.greige_roll_id === r.id)',
  'selectedPof.received_rolls.some(rx => isGreigeRollMatch(rx.greige_roll_id, r.id))'
);

// Replace match 6
procContent = procContent.replace(
  'receivedRolls.filter(rx => rx.greige_roll_id === roll.id)',
  'receivedRolls.filter(rx => isGreigeRollMatch(rx.greige_roll_id, roll.id))'
);

// Replace match 7
procContent = procContent.replace(
  'setEditPofReceivedRolls(prev => prev.filter(rx => rx.greige_roll_id !== roll.id))',
  'setEditPofReceivedRolls(prev => prev.filter(rx => !isGreigeRollMatch(rx.greige_roll_id, roll.id)))'
);

fs.writeFileSync(processingPath, procContent, 'utf8');
console.log('ProcessingModule.jsx updated.');

// 2. Update Management.jsx
let mgmtContent = fs.readFileSync(managementPath, 'utf8');

// Define helper
const mgmtHelperCode = `const isGreigeRollMatch = (rxGreigeRollId, sentRollId) => {
  if (!rxGreigeRollId || !sentRollId) return false;
  const rxLower = rxGreigeRollId.toLowerCase();
  const sentLower = sentRollId.toLowerCase();
  return (
    rxLower === sentLower ||
    sentLower.startsWith(rxLower + '/') ||
    rxLower.startsWith(sentLower + '/')
  );
};

const getTodayString = () => {`;

mgmtContent = mgmtContent.replace('const getTodayString = () => {', mgmtHelperCode);

// Replace match
mgmtContent = mgmtContent.replace(
  'receivedRolls.filter(rx => rx.greige_roll_id === roll.id)',
  'receivedRolls.filter(rx => isGreigeRollMatch(rx.greige_roll_id, roll.id))'
);

fs.writeFileSync(managementPath, mgmtContent, 'utf8');
console.log('Management.jsx updated.');
