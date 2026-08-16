import test from 'node:test';
import assert from 'node:assert/strict';
import {
  countQuadrilaterals,
  countTriangles,
  createAdvancedShapePuzzle,
  createPuzzleFromTemplate,
  createShapePuzzle,
  isSeamlessGeometry,
  SHAPE_PUZZLE_TEMPLATE_IDS
} from './shapePuzzleGenerator.js';

const prepTemplateIds = SHAPE_PUZZLE_TEMPLATE_IDS.filter(templateId => templateId.startsWith('prep-'));
const grade3TemplateIds = SHAPE_PUZZLE_TEMPLATE_IDS.filter(templateId => templateId.startsWith('grade3-'));

const collectGeneratedPuzzles = (generator, level, count) => {
  const usedKeys = new Set();
  const puzzles = [];
  for (let index = 0; index < count; index++) {
    const puzzle = generator(level, () => 0, usedKeys);
    usedKeys.add(puzzle.key);
    puzzles.push(puzzle);
  }
  return puzzles;
};

test('the libraries contain 30 prep drawings and at least 100 advanced templates', () => {
  assert.equal(prepTemplateIds.length, 30);
  assert.ok(grade3TemplateIds.length >= 100);

  const prepDrawings = prepTemplateIds.map(templateId => createPuzzleFromTemplate(templateId, 0).svg);
  const grade3Drawings = grade3TemplateIds.map(templateId => createPuzzleFromTemplate(templateId, 0).svg);
  assert.equal(new Set(prepDrawings).size, 30);
  assert.ok(new Set(grade3Drawings).size >= 100);
});

test('all drawings are seamless across visual variants', () => {
  SHAPE_PUZZLE_TEMPLATE_IDS.forEach(templateId => {
    [0, 7].forEach(variant => {
      const puzzle = createPuzzleFromTemplate(templateId, variant);
      assert.equal(isSeamlessGeometry(puzzle.geometry), true, `${templateId}:${variant}`);
      assert.match(puzzle.svg, /<svg/);
      assert.match(puzzle.svg, /<line/);
    });
  });
});

test('all grade 1 answers are calculated from the drawing and never exceed five', () => {
  prepTemplateIds.forEach(templateId => {
    const puzzle = createPuzzleFromTemplate(templateId, 0);
    const calculatedAnswer = puzzle.target === 'triangle'
      ? countTriangles(puzzle.geometry)
      : countQuadrilaterals(puzzle.geometry, puzzle.target);
    assert.equal(puzzle.ans, calculatedAnswer, templateId);
    assert.ok(puzzle.ans >= 1 && puzzle.ans <= 5, templateId);
  });
});

test('ten-question games do not repeat a drawing family', () => {
  const prepPuzzles = collectGeneratedPuzzles(createShapePuzzle, 1, 10);
  const grade3Puzzles = collectGeneratedPuzzles(createAdvancedShapePuzzle, 1, 10);
  assert.equal(new Set(prepPuzzles.map(puzzle => puzzle.family)).size, 10);
  assert.equal(new Set(grade3Puzzles.map(puzzle => puzzle.family)).size, 10);
});

test('grade 3 shape answers never exceed the current level cap', () => {
  [5, 6, 20, 100].forEach(level => {
    const puzzles = collectGeneratedPuzzles(createAdvancedShapePuzzle, level, 25);
    puzzles.forEach(puzzle => {
      assert.ok(puzzle.ans <= level, `level ${level} generated answer ${puzzle.ans}`);
    });
  });
});
