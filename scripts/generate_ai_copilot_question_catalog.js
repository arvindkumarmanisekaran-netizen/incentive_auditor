const fs = require('fs');
const path = require('path');

const categories = [
  ['Representative profile and lookup', ['Anika’s representative details', 'the profile for Aahana Bassi (FR0011)', 'the representative assigned to territory T045', 'all active representatives', 'representatives who joined during the selected period', 'a representative’s territory and joining date', 'the status of a specified representative', 'representatives matching a partial name']],
  ['Doctor profile and lookup', ['Dr Upasna Mahal’s details', 'the profile for a specified doctor ID', 'the territory assigned to a doctor', 'all doctors handled by Aahana Bassi (FR0011)', 'active doctors in a selected territory', 'doctors matching a partial name', 'a doctor’s specialty and status', 'doctors without an active representative assignment']],
  ['Product profile and lookup', ['details for MolestiaeCare 5 (P005)', 'the name of product P029', 'all active products', 'products matching a partial name', 'product details for the selected investigation', 'products sold by Aahana Bassi (FR0011)', 'products with prescriptions in the selected period', 'products without sales in the selected period']],
  ['Territory profile and lookup', ['details for territory T045', 'the home territory of Aahana Bassi (FR0011)', 'all active territories', 'representatives working in a selected territory', 'doctors located in a selected territory', 'sales attributed to a selected territory', 'territories matching a partial name or ID', 'territories with no activity in the selected period']],
  ['Representative-doctor assignments', ['current doctor assignments for Aahana Bassi (FR0011)', 'the representative assigned to Dr Upasna Mahal', 'assignments active on a specified date', 'assignments ending during the selected period', 'inactive representative-doctor assignments', 'duplicate assignment records', 'doctors assigned to multiple representatives', 'assignment history for a selected doctor']],
  ['Sales totals and summaries', ['total sales for Aahana Bassi (FR0011)', 'total sales for MolestiaeCare 5 (P005)', 'sales by product in the selected period', 'sales by doctor in the selected period', 'sales by territory in the selected period', 'the average sale value', 'the number of sales records', 'a concise summary of selected-period sales']],
  ['Sales trends and movement', ['monthly sales trends', 'sales growth versus the previous period', 'products with declining sales', 'the largest sales increase', 'daily sales movement in the selected period', 'historical sales for a selected product', 'sales changes for Aahana Bassi (FR0011)', 'unusual spikes or drops in sales']],
  ['Sales rankings and comparisons', ['top products by sales', 'bottom products by sales', 'top doctors by attributed sales', 'representative sales rankings', 'territory sales rankings', 'sales for one product compared with another', 'a representative compared with their peers', 'the contribution percentage of each product']],
  ['Prescription totals and patterns', ['total prescriptions for Aahana Bassi (FR0011)', 'prescriptions for MolestiaeCare 5 (P005)', 'prescriptions by product', 'prescriptions by doctor', 'monthly prescription trends', 'products with declining prescription volume', 'top doctors by prescriptions', 'unusual prescription spikes or drops']],
  ['Sales-prescription alignment', ['sales change compared with prescription change', 'products where sales and prescriptions moved in opposite directions', 'the highest sales-prescription mismatch', 'the mismatch score for MolestiaeCare 5 (P005)', 'products with aligned sales and prescription growth', 'why a selected product was flagged for mismatch', 'sales-prescription alignment for Aahana Bassi (FR0011)', 'all mismatch findings by severity']],
  ['Doctor concentration analysis', ['the top doctor by sales share', 'the top doctor’s name and share', 'the top three doctors’ combined share', 'doctor concentration for Aahana Bassi (FR0011)', 'sales distribution across assigned doctors', 'whether doctor concentration is risky', 'the least active assigned doctors', 'doctor concentration compared with peers']],
  ['Territory and cross-territory behavior', ['home-territory sales share', 'cross-territory sales share', 'territories receiving attributed sales', 'territory behavior for Aahana Bassi (FR0011)', 'doctors generating cross-territory sales', 'products sold outside the home territory', 'whether cross-territory behavior is anomalous', 'territory distribution compared with peers']],
  ['Payout totals and status', ['total expected payout', 'total recorded payout', 'the net payout difference', 'payouts by product', 'payouts by month', 'payout records by status', 'products with missing payouts', 'a payout summary for Aahana Bassi (FR0011)']],
  ['Payout discrepancies and anomaly subtypes', ['all payout discrepancies', 'missing payout findings', 'duplicate payout findings', 'multiplier mismatch findings', 'maximum-cap mismatch findings', 'payout discrepancies by severity', 'the largest payout variance', 'why ExcepturiCare 29 (P029) has a payout discrepancy']],
  ['Payout calculation and reconciliation', ['the payout calculation breakup', 'recorded versus calculated payout at each stage', 'base incentive by product', 'the applied program percentage', 'the achievement tier and multiplier used', 'the capped and uncapped incentive values', 'a detailed payout reconciliation table', 'the formula used to calculate a selected payout']],
  ['Incentive programs', ['active incentive programs in the selected period', 'the program covering MolestiaeCare 5 (P005)', 'products included in a specified program', 'a program’s start and end dates', 'the percentage offered by a program', 'overlapping incentive programs', 'programs expiring soon', 'incentive program details used in a payout']],
  ['Incentive program tiers', ['tiers for a specified incentive program', 'the achievement bands and multipliers', 'the tier reached by MolestiaeCare 5 (P005)', 'why an achievement multiplier is below one', 'the next tier threshold', 'products using a selected tier rule', 'tier rules active on a specified date', 'how payout changes at each achievement band']],
  ['Program eligibility and date coverage', ['whether a product was eligible on a specified date', 'products without program coverage', 'periods using the default base-incentive rule', 'why the 1.5 fallback multiplier was applied', 'program eligibility for Aahana Bassi (FR0011)', 'coverage gaps between incentive programs', 'eligible products for a selected month', 'the rule chosen when programs overlap']],
  ['Peer benchmarking', ['Aahana Bassi (FR0011) compared with peers', 'the representative-versus-peer sales index', 'the representative-versus-peer prescription index', 'the representative-versus-peer payout index', 'peer percentile rankings', 'the peer group used for comparison', 'metrics below the peer average', 'the strongest metric relative to peers']],
  ['Historical comparisons', ['current sales versus the historical average', 'historical position for Aahana Bassi (FR0011)', 'the historical baseline period', 'products below their historical sales average', 'prescriptions versus the historical baseline', 'payout versus historical payouts', 'the largest historical deviation', 'whether movement is within the normal analytical range']],
  ['Investigation workflow and evidence', ['the current investigation status', 'completed investigation stages', 'stages still running or waiting', 'the Investigation Planner’s findings', 'sales and prescription evidence', 'territory behavior evidence', 'payout validation evidence', 'the evidence supporting the final decision']],
  ['Risk severity and review decision', ['the overall investigation risk score', 'all high-severity findings', 'findings grouped by severity', 'why human review is required', 'the factors contributing to the risk score', 'the final investigation assessment', 'recommended next actions', 'whether the investigation can be closed']],
  ['Date-filtered comparative analysis', ['results for a custom date range', 'this month compared with last month', 'the selected quarter compared with the prior quarter', 'year-to-date sales and payouts', 'results before and after a specified date', 'the best-performing month', 'the worst-performing month', 'the same analysis for a different period']],
  ['Status exceptions and data quality', ['inactive records used in calculations', 'records with missing required values', 'duplicate operational records', 'orphaned sales or prescription records', 'invalid date ranges', 'unknown product or representative IDs', 'data-quality issues affecting the investigation', 'a count of clean versus problematic records']],
  ['Conversational follow-ups and references', ['more details about that representative', 'the same analysis for Anika', 'the products behind that finding', 'why that result is considered unusual', 'the calculation behind that number', 'the same comparison for the previous month', 'a simpler explanation of the finding', 'a concise executive summary of these results']],
];

const forms = [
  x => `Show me ${x}.`,
  x => `Can you show me ${x}?`,
  x => `Please provide ${x}.`,
  x => `I need to see ${x}.`,
  x => `Help me understand ${x}.`,
];

const questions = [];
let id = 1;
for (const [category, intents] of categories) {
  for (const intent of intents) {
    for (const form of forms) {
      questions.push({ id: `Q${String(id++).padStart(4, '0')}`, category, question: form(intent) });
    }
  }
}

if (questions.length !== 1000) throw new Error(`Expected 1000 questions, got ${questions.length}`);
if (new Set(questions.map(q => q.question)).size !== 1000) throw new Error('Questions are not unique');

const generated = '2026-08-29';
const outDir = path.resolve(__dirname, '..', 'docs');
const json = { title: 'AI Copilot — 1,000 Current-Data Question Catalog', generated, total: questions.length, categoryCount: categories.length, questions };
fs.writeFileSync(path.join(outDir, 'ai-copilot-1000-question-catalog.json'), `${JSON.stringify(json, null, 2)}\n`);

const lines = [
  '# AI Copilot — 1,000 Current-Data Questions', '',
  'This catalog covers questions answerable from the current operational, incentive, payout, and investigation data. Each semantic intent appears in five natural phrasings to test phrasing tolerance and conversational consistency.', '',
  `- Total questions: ${questions.length}`,
  `- Capability categories: ${categories.length}`,
  '- Naming convention: `Product Name (Product ID)` and `Representative Name (Representative ID)`', '',
];
for (const [category] of categories) {
  lines.push(`## ${category}`, '');
  for (const q of questions.filter(q => q.category === category)) lines.push(`${q.id}. ${q.question}`);
  lines.push('');
}
fs.writeFileSync(path.join(outDir, 'ai-copilot-1000-question-catalog.md'), `${lines.join('\n')}\n`);

console.log(`Generated ${questions.length} unique questions across ${categories.length} categories.`);
