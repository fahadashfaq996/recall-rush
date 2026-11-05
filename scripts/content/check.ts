/** Validates every content pack and prints a short inventory. `pnpm content:check` */
import { PACKS, RULES_VERSION, validatePacks } from "../../packages/engine/src/content";

const issues = validatePacks(PACKS);
const answers = PACKS.trivia.reduce<Record<number, number>>((acc, t) => ((acc[t.answer] = (acc[t.answer] ?? 0) + 1), acc), {});
const trues = PACKS.truth.filter((t) => t.truth).length;

console.log(`rules version ${RULES_VERSION}`);
console.log(`trivia      ${PACKS.trivia.length}  answers ${JSON.stringify(answers)}`);
console.log(`truth       ${PACKS.truth.length}  (${trues} true / ${PACKS.truth.length - trues} false)`);
console.log(`categories  ${PACKS.categories.length}`);
console.log(`wordsets    ${PACKS.wordsets.length}`);

if (issues.length) {
  console.error(`\n${issues.length} problem(s):`);
  for (const i of issues) console.error(`  ${i.pack}/${i.id}: ${i.errors.join("; ")}`);
  process.exit(1);
}
console.log("\nAll packs valid.");
