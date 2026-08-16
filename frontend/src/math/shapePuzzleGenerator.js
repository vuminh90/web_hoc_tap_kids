const EPSILON = 1e-6;

const PALETTES = [
  { stroke: '#123A78', fill: '#FFF7C7' },
  { stroke: '#145A4A', fill: '#EAF8D5' },
  { stroke: '#71346F', fill: '#F8E8F5' },
  { stroke: '#8A3E16', fill: '#FFF0D2' }
];

const point = (x, y) => ({ x, y });
const segment = (a, b) => ({ a, b });
const vector = (a, b) => ({ x: b.x - a.x, y: b.y - a.y });
const crossVector = (a, b) => a.x * b.y - a.y * b.x;
const dotVector = (a, b) => a.x * b.x + a.y * b.y;
const distanceSquared = (a, b) => ((a.x - b.x) ** 2) + ((a.y - b.y) ** 2);
const crossPoints = (a, b, c) => crossVector(vector(a, b), vector(a, c));
const nearlyEqual = (a, b) => Math.abs(a - b) <= EPSILON;
const samePoint = (a, b) => distanceSquared(a, b) <= EPSILON ** 2;
const lerpPoint = (a, b, ratio) => point(
  a.x + ((b.x - a.x) * ratio),
  a.y + ((b.y - a.y) * ratio)
);

const addUniquePoint = (points, candidate) => {
  const existing = points.find(item => samePoint(item, candidate));
  if (existing) return existing;
  points.push(candidate);
  return candidate;
};

const isPointOnSegment = (candidate, line) => {
  if (Math.abs(crossPoints(line.a, line.b, candidate)) > EPSILON) return false;
  const direction = vector(line.a, line.b);
  const projection = dotVector(vector(line.a, candidate), direction);
  return projection >= -EPSILON && projection <= dotVector(direction, direction) + EPSILON;
};

const getSegmentIntersection = (first, second) => {
  const firstDirection = vector(first.a, first.b);
  const secondDirection = vector(second.a, second.b);
  const denominator = crossVector(firstDirection, secondDirection);

  if (Math.abs(denominator) <= EPSILON) return null;

  const betweenStarts = vector(first.a, second.a);
  const firstRatio = crossVector(betweenStarts, secondDirection) / denominator;
  const secondRatio = crossVector(betweenStarts, firstDirection) / denominator;

  if (
    firstRatio < -EPSILON || firstRatio > 1 + EPSILON ||
    secondRatio < -EPSILON || secondRatio > 1 + EPSILON
  ) return null;

  return point(
    first.a.x + (firstDirection.x * firstRatio),
    first.a.y + (firstDirection.y * firstRatio)
  );
};

export const collectGeometryPoints = (segments) => {
  const points = [];

  segments.forEach(line => {
    addUniquePoint(points, line.a);
    addUniquePoint(points, line.b);
  });

  for (let firstIndex = 0; firstIndex < segments.length; firstIndex++) {
    for (let secondIndex = firstIndex + 1; secondIndex < segments.length; secondIndex++) {
      const intersection = getSegmentIntersection(segments[firstIndex], segments[secondIndex]);
      if (intersection) addUniquePoint(points, intersection);
    }
  }

  return points;
};

const hasContinuousStraightEdge = (start, end, segments) => {
  const direction = vector(start, end);
  const lengthSquared = dotVector(direction, direction);
  if (lengthSquared <= EPSILON) return false;

  const intervals = [];
  segments.forEach(line => {
    if (
      Math.abs(crossPoints(start, end, line.a)) > EPSILON ||
      Math.abs(crossPoints(start, end, line.b)) > EPSILON
    ) return;

    const firstRatio = dotVector(vector(start, line.a), direction) / lengthSquared;
    const secondRatio = dotVector(vector(start, line.b), direction) / lengthSquared;
    const from = Math.max(0, Math.min(firstRatio, secondRatio));
    const to = Math.min(1, Math.max(firstRatio, secondRatio));
    if (to >= from - EPSILON) intervals.push([from, to]);
  });

  intervals.sort((first, second) => first[0] - second[0]);
  if (intervals.length === 0 || intervals[0][0] > EPSILON) return false;

  let coveredUntil = intervals[0][1];
  for (let index = 1; index < intervals.length && coveredUntil < 1 - EPSILON; index++) {
    if (intervals[index][0] > coveredUntil + EPSILON) return false;
    coveredUntil = Math.max(coveredUntil, intervals[index][1]);
  }

  return coveredUntil >= 1 - EPSILON;
};

export const countTriangles = (geometry) => {
  const points = collectGeometryPoints(geometry.segments);
  let count = 0;

  for (let first = 0; first < points.length; first++) {
    for (let second = first + 1; second < points.length; second++) {
      for (let third = second + 1; third < points.length; third++) {
        const a = points[first];
        const b = points[second];
        const c = points[third];
        if (Math.abs(crossPoints(a, b, c)) <= EPSILON) continue;

        if (
          hasContinuousStraightEdge(a, b, geometry.segments) &&
          hasContinuousStraightEdge(b, c, geometry.segments) &&
          hasContinuousStraightEdge(c, a, geometry.segments)
        ) count++;
      }
    }
  }

  return count;
};

const sortClockwise = (points) => {
  const center = points.reduce(
    (sum, item) => point(sum.x + (item.x / points.length), sum.y + (item.y / points.length)),
    point(0, 0)
  );
  return [...points].sort((a, b) => (
    Math.atan2(a.y - center.y, a.x - center.x) -
    Math.atan2(b.y - center.y, b.x - center.x)
  ));
};

const isRectangle = (corners, segments) => {
  const ordered = sortClockwise(corners);
  const sides = ordered.map((corner, index) => vector(corner, ordered[(index + 1) % 4]));
  const sideLengths = sides.map(side => dotVector(side, side));
  if (sideLengths.some(length => length <= EPSILON)) return false;

  const hasRightAngles = sides.every((side, index) => {
    const nextSide = sides[(index + 1) % 4];
    return Math.abs(dotVector(side, nextSide)) <= EPSILON;
  });
  if (!hasRightAngles) return false;

  return ordered.every((corner, index) => (
    hasContinuousStraightEdge(corner, ordered[(index + 1) % 4], segments)
  ));
};

export const countQuadrilaterals = (geometry, target = 'rectangle') => {
  const points = collectGeometryPoints(geometry.segments);
  let count = 0;

  for (let first = 0; first < points.length; first++) {
    for (let second = first + 1; second < points.length; second++) {
      for (let third = second + 1; third < points.length; third++) {
        for (let fourth = third + 1; fourth < points.length; fourth++) {
          const corners = [points[first], points[second], points[third], points[fourth]];
          if (!isRectangle(corners, geometry.segments)) continue;

          const ordered = sortClockwise(corners);
          const firstSide = distanceSquared(ordered[0], ordered[1]);
          const secondSide = distanceSquared(ordered[1], ordered[2]);
          const isSquare = nearlyEqual(firstSide, secondSide);

          if (target === 'square' ? isSquare : !isSquare) count++;
        }
      }
    }
  }

  return count;
};

const getSplitAdjacency = (geometry) => {
  const points = collectGeometryPoints(geometry.segments);
  const adjacency = points.map(() => new Set());

  geometry.segments.forEach(line => {
    const pointsOnLine = points
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => isPointOnSegment(item, line))
      .sort((first, second) => distanceSquared(line.a, first.item) - distanceSquared(line.a, second.item));

    for (let index = 0; index < pointsOnLine.length - 1; index++) {
      const from = pointsOnLine[index].index;
      const to = pointsOnLine[index + 1].index;
      adjacency[from].add(to);
      adjacency[to].add(from);
    }
  });

  return { points, adjacency };
};

export const isSeamlessGeometry = (geometry) => {
  const { points, adjacency } = getSplitAdjacency(geometry);
  if (points.length === 0 || adjacency.some(neighbors => neighbors.size < 2)) return false;

  const visited = new Set([0]);
  const queue = [0];
  while (queue.length > 0) {
    const current = queue.shift();
    adjacency[current].forEach(next => {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    });
  }

  return visited.size === points.length;
};

const createTriangleFrame = (variant) => {
  const apexOffsets = [0, -10, 10, -5];
  const apex = point(210 + apexOffsets[variant % apexOffsets.length], 22);
  const left = point(42, 238);
  const right = point(378, 238);
  return { apex, left, right, fillPoints: [apex, right, left] };
};

const createTriangleFan = (divisions, variant) => {
  const frame = createTriangleFrame(variant);
  const segments = [
    segment(frame.apex, frame.left),
    segment(frame.left, frame.right),
    segment(frame.right, frame.apex)
  ];

  for (let index = 1; index < divisions; index++) {
    segments.push(segment(frame.apex, lerpPoint(frame.left, frame.right, index / divisions)));
  }

  return { width: 420, height: 260, segments, fillPoints: frame.fillPoints };
};

const createRectangleGrid = (rows, columns, squareCells, variant, diagonal = false) => {
  const squareCellSize = Math.min(62, 280 / Math.max(rows, columns));
  const rectangleScale = Math.min(2.5, 300 / (34 * columns), 190 / (24 * rows));
  const cellWidth = squareCells ? squareCellSize : 34 * rectangleScale;
  const cellHeight = squareCells ? squareCellSize : 24 * rectangleScale;
  const width = cellWidth * columns;
  const height = cellHeight * rows;
  const left = (420 - width) / 2;
  const top = (260 - height) / 2 + ((variant % 3) - 1) * 3;
  const segments = [];

  for (let row = 0; row <= rows; row++) {
    segments.push(segment(point(left, top + (row * cellHeight)), point(left + width, top + (row * cellHeight))));
  }
  for (let column = 0; column <= columns; column++) {
    segments.push(segment(point(left + (column * cellWidth), top), point(left + (column * cellWidth), top + height)));
  }
  if (diagonal) {
    segments.push(segment(point(left, top), point(left + width, top + height)));
  }

  return {
    width: 420,
    height: 260,
    segments,
    fillPoints: [point(left, top), point(left + width, top), point(left + width, top + height), point(left, top + height)]
  };
};

const createTriangleGrid = (order, variant) => {
  const step = Math.min(86, 336 / order);
  const rowHeight = step * 0.82;
  const top = 24;
  const centerX = 210 + ((variant % 3) - 1) * 5;
  const rows = [];

  for (let row = 0; row <= order; row++) {
    const rowPoints = [];
    for (let column = 0; column <= row; column++) {
      rowPoints.push(point(
        centerX - ((row * step) / 2) + (column * step),
        top + (row * rowHeight)
      ));
    }
    rows.push(rowPoints);
  }

  const segments = [];
  for (let row = 0; row <= order; row++) {
    for (let column = 0; column < row; column++) {
      segments.push(segment(rows[row][column], rows[row][column + 1]));
    }
    if (row < order) {
      for (let column = 0; column <= row; column++) {
        segments.push(segment(rows[row][column], rows[row + 1][column]));
        segments.push(segment(rows[row][column], rows[row + 1][column + 1]));
      }
    }
  }

  return {
    width: 420,
    height: Math.ceil(top + (order * rowHeight) + 18),
    segments,
    fillPoints: [rows[0][0], rows[order][order], rows[order][0]]
  };
};

const createTrianglePattern = (mask, variant) => {
  const frame = createTriangleFrame(variant);
  const leftMiddle = lerpPoint(frame.apex, frame.left, 0.52);
  const rightMiddle = lerpPoint(frame.apex, frame.right, 0.52);
  const baseMiddle = lerpPoint(frame.left, frame.right, 0.5);
  const baseQuarter = lerpPoint(frame.left, frame.right, 0.28);
  const baseThreeQuarter = lerpPoint(frame.left, frame.right, 0.72);
  const candidates = [
    segment(frame.apex, baseMiddle),
    segment(leftMiddle, rightMiddle),
    segment(leftMiddle, baseMiddle),
    segment(rightMiddle, baseMiddle),
    segment(leftMiddle, frame.right),
    segment(rightMiddle, frame.left),
    segment(frame.apex, baseQuarter),
    segment(frame.apex, baseThreeQuarter)
  ];
  const segments = [
    segment(frame.apex, frame.left),
    segment(frame.left, frame.right),
    segment(frame.right, frame.apex),
    ...candidates.filter((_, index) => (mask & (1 << index)) !== 0)
  ];
  return { width: 420, height: 260, segments, fillPoints: frame.fillPoints };
};

const createFourSidePattern = (mask, variant, square) => {
  const width = square ? 180 : 246;
  const height = square ? 180 : 132;
  const left = (420 - width) / 2;
  const top = (260 - height) / 2 + ((variant % 3) - 1) * 3;
  const topLeft = point(left, top);
  const topRight = point(left + width, top);
  const bottomRight = point(left + width, top + height);
  const bottomLeft = point(left, top + height);
  const topMiddle = lerpPoint(topLeft, topRight, 0.5);
  const bottomMiddle = lerpPoint(bottomLeft, bottomRight, 0.5);
  const leftMiddle = lerpPoint(topLeft, bottomLeft, 0.5);
  const rightMiddle = lerpPoint(topRight, bottomRight, 0.5);
  const candidates = [
    segment(topLeft, bottomRight),
    segment(topRight, bottomLeft),
    segment(topMiddle, bottomMiddle),
    segment(leftMiddle, rightMiddle),
    segment(topMiddle, bottomLeft),
    segment(topMiddle, bottomRight),
    segment(leftMiddle, bottomRight),
    segment(rightMiddle, bottomLeft)
  ];
  const segments = [
    segment(topLeft, topRight),
    segment(topRight, bottomRight),
    segment(bottomRight, bottomLeft),
    segment(bottomLeft, topLeft),
    ...candidates.filter((_, index) => (mask & (1 << index)) !== 0)
  ];
  return {
    width: 420,
    height: 260,
    segments,
    fillPoints: [topLeft, topRight, bottomRight, bottomLeft]
  };
};

const countBits = value => value.toString(2).replaceAll('0', '').length;
const countTargetShapes = (geometry, target) => (
  target === 'triangle' ? countTriangles(geometry) : countQuadrilaterals(geometry, target)
);

const selectDiversePatterns = (kind, factory, targets, limit) => {
  const candidates = [];
  for (let mask = 1; mask < 256; mask++) {
    if (countBits(mask) > 5) continue;
    const geometry = factory(mask, 0);
    if (!isSeamlessGeometry(geometry)) continue;

    const preferredTargets = mask % 2 === 0 ? targets : [...targets].reverse();
    const target = preferredTargets.find(item => {
      const answer = countTargetShapes(geometry, item);
      return answer >= 1 && answer <= 5;
    });
    if (!target) continue;

    candidates.push({ mask, target, answer: countTargetShapes(geometry, target), complexity: countBits(mask) });
  }

  const selected = [];
  for (let complexity = 1; complexity <= 5 && selected.length < limit; complexity++) {
    const group = candidates.filter(item => item.complexity === complexity);
    selected.push(...group.slice(0, 2));
  }
  candidates.forEach(candidate => {
    if (selected.length < limit && !selected.some(item => item.mask === candidate.mask)) selected.push(candidate);
  });

  if (selected.length < limit) throw new Error(`Not enough beginner patterns for ${kind}`);
  return selected.slice(0, limit).map((item, index) => ({
    id: `prep-${kind}-${String(index + 1).padStart(2, '0')}`,
    profile: 'prep',
    target: item.target,
    answer: item.answer,
    skill: item.target === 'triangle'
      ? 'Đếm hình tam giác liền mạch'
      : (item.target === 'square' ? 'Đếm hình vuông liền mạch' : 'Đếm hình chữ nhật liền mạch'),
    factory: variant => factory(item.mask, variant)
  }));
};

const createPrepDefinitions = () => [
  ...selectDiversePatterns('triangle', createTrianglePattern, ['triangle'], 10),
  ...selectDiversePatterns('square', (mask, variant) => createFourSidePattern(mask, variant, true), ['triangle', 'square'], 10),
  ...selectDiversePatterns('rectangle', (mask, variant) => createFourSidePattern(mask, variant, false), ['triangle', 'rectangle'], 10)
];

const rectangleCount = (rows, columns) => ((rows * (rows + 1)) / 2) * ((columns * (columns + 1)) / 2);
const squareCount = (rows, columns) => {
  let total = 0;
  for (let size = 1; size <= Math.min(rows, columns); size++) {
    total += (rows - size + 1) * (columns - size + 1);
  }
  return total;
};
const triangleGridCount = order => (
  order % 2 === 0
    ? (order * (order + 2) * ((2 * order) + 1)) / 8
    : ((order * (order + 2) * ((2 * order) + 1)) - 1) / 8
);

const createGrade3Definitions = () => {
  const beginnerSpecs = createPrepDefinitions()
    .filter(item => item.answer >= 3 && item.answer <= 5)
    .map((item, index) => ({
      ...item,
      id: `grade3-beginner-prep-${String(index + 1).padStart(2, '0')}`,
      profile: 'grade3',
      skill: `${item.skill} - luyá»‡n nÃ¢ng cao`
    }));
  const specs = [
    ...beginnerSpecs,
    {
      id: 'grade3-beginner-rectangle-1x2',
      target: 'rectangle',
      answer: rectangleCount(1, 2),
      skill: 'LÆ°á»›i chá»¯ nháº­t 1 hÃ ng 2 cá»™t',
      factory: variant => createRectangleGrid(1, 2, false, variant)
    },
    {
      id: 'grade3-beginner-square-1x3',
      target: 'square',
      answer: squareCount(1, 3),
      skill: 'LÆ°á»›i Ã´ vuÃ´ng 1 hÃ ng 3 cá»™t',
      factory: variant => createRectangleGrid(1, 3, true, variant)
    },
    {
      id: 'grade3-beginner-square-2x2',
      target: 'square',
      answer: squareCount(2, 2),
      skill: 'LÆ°á»›i Ã´ vuÃ´ng 2 hÃ ng 2 cá»™t',
      factory: variant => createRectangleGrid(2, 2, true, variant)
    },
    {
      id: 'grade3-beginner-rectangle-1x3',
      target: 'rectangle',
      answer: rectangleCount(1, 3),
      skill: 'LÆ°á»›i chá»¯ nháº­t 1 hÃ ng 3 cá»™t',
      factory: variant => createRectangleGrid(1, 3, false, variant)
    },
    {
      id: 'grade3-beginner-triangle-fan-2',
      target: 'triangle',
      answer: 3,
      skill: 'Tam giÃ¡c quáº¡t 2 pháº§n',
      factory: variant => createTriangleFan(2, variant)
    },
    {
      id: 'grade3-beginner-triangle-fan-3',
      target: 'triangle',
      answer: 6,
      skill: 'Tam giÃ¡c quáº¡t 3 pháº§n',
      factory: variant => createTriangleFan(3, variant)
    }
  ];
  for (let rows = 2; rows <= 7; rows++) {
    for (let columns = 2; columns <= 8; columns++) {
      specs.push({
        id: `grade3-rectangle-${rows}x${columns}`,
        target: 'rectangle',
        answer: rectangleCount(rows, columns),
        skill: `Lưới chữ nhật ${rows} hàng ${columns} cột`,
        factory: variant => createRectangleGrid(rows, columns, false, variant)
      });
      if (rows !== 2 || columns !== 2) {
        specs.push({
          id: `grade3-square-${rows}x${columns}`,
          target: 'square',
          answer: squareCount(rows, columns),
          skill: `Lưới ô vuông ${rows} hàng ${columns} cột`,
          factory: variant => createRectangleGrid(rows, columns, true, variant, true)
        });
      }
    }
  }
  for (let divisions = 5; divisions <= 14; divisions++) {
    specs.push({
      id: `grade3-triangle-fan-${divisions}`,
      target: 'triangle',
      answer: (divisions * (divisions + 1)) / 2,
      skill: `Tam giác quạt ${divisions} phần`,
      factory: variant => createTriangleFan(divisions, variant)
    });
  }
  for (let order = 3; order <= 9; order++) {
    specs.push({
      id: `grade3-triangle-grid-${order}`,
      target: 'triangle',
      answer: triangleGridCount(order),
      skill: `Lưới tam giác ${order} tầng`,
      factory: variant => createTriangleGrid(order, variant)
    });
  }

  const stages = ['foundation', 'advanced', 'expert', 'master'];
  return specs
    .sort((first, second) => first.answer - second.answer)
    .map((spec, index) => ({
      ...spec,
      profile: 'grade3',
      stage: stages[Math.floor(index / 25)]
    }));
};

const TEMPLATE_DEFINITIONS = [
  ...createPrepDefinitions(),
  ...createGrade3Definitions()
];

const TARGET_LABELS = {
  triangle: 'hình tam giác',
  square: 'hình vuông',
  rectangle: 'hình chữ nhật'
};

const getGrade3Stage = (level) => {
  if (level <= 1) return 'foundation';
  if (level === 2) return 'advanced';
  if (level <= 4) return 'expert';
  return 'master';
};

const getGrade3AnswerLimit = (level) => Math.min(100, Math.max(5, level));

const getAnswer = (geometry, target) => (
  target === 'triangle' ? countTriangles(geometry) : countQuadrilaterals(geometry, target)
);

const formatNumber = value => Number(value.toFixed(3));
const escapeXml = value => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

const renderGeometrySvg = (geometry, target, variant) => {
  const palette = PALETTES[variant % PALETTES.length];
  const title = `Đếm ${TARGET_LABELS[target]} trong hình liền mạch`;
  const fillPoints = geometry.fillPoints
    .map(item => `${formatNumber(item.x)},${formatNumber(item.y)}`)
    .join(' ');
  const lines = geometry.segments.map(line => (
    `<line x1="${formatNumber(line.a.x)}" y1="${formatNumber(line.a.y)}" x2="${formatNumber(line.b.x)}" y2="${formatNumber(line.b.y)}"/>`
  )).join('');

  return `<svg viewBox="0 0 ${geometry.width} ${geometry.height}" width="100%" style="max-width:440px;height:auto;display:block" role="img" aria-label="${escapeXml(title)}"><title>${escapeXml(title)}</title><polygon points="${fillPoints}" fill="${palette.fill}"/><g fill="none" stroke="${palette.stroke}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke">${lines}</g></svg>`;
};

export const createPuzzleFromTemplate = (templateId, variant = 0) => {
  const definition = TEMPLATE_DEFINITIONS.find(item => item.id === templateId);
  if (!definition) throw new Error(`Unknown shape puzzle template: ${templateId}`);

  const normalizedVariant = Math.abs(variant) % 8;
  const geometry = definition.factory(normalizedVariant);
  if (!isSeamlessGeometry(geometry)) {
    throw new Error(`Shape puzzle template is not seamless: ${templateId}`);
  }

  const ans = definition.answer ?? getAnswer(geometry, definition.target);
  return {
    q: `Có bao nhiêu ${TARGET_LABELS[definition.target]} trong hình dưới đây?`,
    ans,
    svg: renderGeometrySvg(geometry, definition.target, normalizedVariant),
    skill: definition.skill,
    key: `${definition.id}:${normalizedVariant}`,
    family: definition.id,
    target: definition.target,
    geometry
  };
};

const createBalancedPuzzle = (definitions, random, excludedKeys) => {
  const usageCounts = definitions.map(definition => ({
    definition,
    count: [...excludedKeys].filter(key => key.startsWith(`${definition.id}:`)).length
  }));
  const minimumUsage = Math.min(...usageCounts.map(item => item.count));
  const leastUsed = usageCounts.filter(item => item.count === minimumUsage);
  const chosen = leastUsed[Math.floor(random() * leastUsed.length)].definition;
  const availableVariants = Array.from({ length: 8 }, (_, index) => index)
    .filter(variant => !excludedKeys.has(`${chosen.id}:${variant}`));
  const variantPool = availableVariants.length > 0 ? availableVariants : Array.from({ length: 8 }, (_, index) => index);
  const variant = variantPool[Math.floor(random() * variantPool.length)];

  return createPuzzleFromTemplate(chosen.id, variant);
};

export const createShapePuzzle = (_level, random = Math.random, excludedKeys = new Set()) => {
  const definitions = TEMPLATE_DEFINITIONS.filter(item => item.profile === 'prep');
  return createBalancedPuzzle(definitions, random, excludedKeys);
};

export const createAdvancedShapePuzzle = (level, random = Math.random, excludedKeys = new Set()) => {
  const answerLimit = getGrade3AnswerLimit(level);
  const definitions = TEMPLATE_DEFINITIONS
    .filter(item => item.profile === 'grade3' && item.answer >= 1 && item.answer <= answerLimit)
    .sort((first, second) => second.answer - first.answer);
  return createBalancedPuzzle(definitions, random, excludedKeys);
};

export const SHAPE_PUZZLE_TEMPLATE_IDS = TEMPLATE_DEFINITIONS.map(item => item.id);
