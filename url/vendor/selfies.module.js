// node_modules/selfies-js/src/tokenizer.js
function tokenize(selfies) {
  if (selfies === "") {
    return [];
  }
  const tokens = [];
  let current = "";
  let inToken = false;
  for (let i = 0; i < selfies.length; i++) {
    const char = selfies[i];
    if (char === "[") {
      if (inToken) {
        throw new Error(`Unclosed bracket at position ${i}`);
      }
      inToken = true;
      current = "[";
    } else if (char === "]") {
      if (!inToken) {
        throw new Error(`Unexpected closing bracket at position ${i}`);
      }
      current += "]";
      if (current === "[]") {
        throw new Error(`Empty token at position ${i - 1}`);
      }
      tokens.push(current);
      current = "";
      inToken = false;
    } else if (inToken) {
      current += char;
    } else {
      throw new Error(`Character '${char}' outside of token at position ${i}`);
    }
  }
  if (inToken) {
    throw new Error(`Unclosed bracket at end of string`);
  }
  return tokens;
}

// node_modules/selfies-js/src/constraints.js
var PRESET_CONSTRAINTS = {
  // Default constraints (balanced between permissive and realistic)
  default: {
    "H": 1,
    "F": 1,
    "Cl": 1,
    "Br": 1,
    "I": 1,
    "O": 2,
    "O+1": 3,
    "O-1": 1,
    "N": 3,
    "N+1": 4,
    "N-1": 2,
    "C": 4,
    "C+1": 3,
    "C-1": 3,
    "B": 3,
    "B+1": 2,
    "B-1": 4,
    "S": 6,
    "S+1": 5,
    "S-1": 5,
    "P": 5,
    "P+1": 4,
    "P-1": 6,
    "?": 8
    // Default for unspecified atoms
  },
  // Octet rule (stricter, follows traditional chemistry)
  octet_rule: {
    "H": 1,
    "F": 1,
    "Cl": 1,
    "Br": 1,
    "I": 1,
    "O": 2,
    "O+1": 3,
    "O-1": 1,
    "N": 3,
    "N+1": 4,
    "N-1": 2,
    "C": 4,
    "C+1": 3,
    "C-1": 3,
    "B": 3,
    "B+1": 2,
    "B-1": 4,
    "S": 2,
    "S+1": 3,
    "S-1": 1,
    // Stricter than default
    "P": 3,
    "P+1": 2,
    "P-1": 4,
    // Stricter than default
    "?": 8
  },
  // Hypervalent (more permissive for heavy elements)
  hypervalent: {
    "H": 1,
    "F": 1,
    "Cl": 7,
    "Br": 7,
    "I": 7,
    // More permissive for halogens
    "O": 2,
    "O+1": 3,
    "O-1": 1,
    "N": 5,
    "N+1": 6,
    "N-1": 4,
    // More permissive
    "C": 4,
    "C+1": 3,
    "C-1": 3,
    "B": 3,
    "B+1": 2,
    "B-1": 4,
    "S": 6,
    "S+1": 5,
    "S-1": 5,
    "P": 5,
    "P+1": 4,
    "P-1": 6,
    "?": 8
  }
};
var _currentConstraints = { ...PRESET_CONSTRAINTS.default };
function getBondingCapacity(element, charge = 0) {
  const key = charge === 0 ? element : `${element}${charge > 0 ? "+" : ""}${charge}`;
  if (key in _currentConstraints) {
    return _currentConstraints[key];
  }
  return _currentConstraints["?"];
}

// node_modules/selfies-js/src/grammar_rules.js
var INDEX_ALPHABET = [
  "[C]",
  "[Ring1]",
  "[Ring2]",
  "[Branch1]",
  "[=Branch1]",
  "[#Branch1]",
  "[Branch2]",
  "[=Branch2]",
  "[#Branch2]",
  "[O]",
  "[N]",
  "[=N]",
  "[=C]",
  "[#C]",
  "[S]",
  "[P]"
];
var INDEX_CODE = {};
for (let i = 0; i < INDEX_ALPHABET.length; i++) {
  INDEX_CODE[INDEX_ALPHABET[i]] = i;
}
function processBranchSymbol(symbol) {
  const match = symbol.match(/^\[(=|#)?Branch([1-3])\]$/);
  if (!match) return null;
  const bondChar = match[1] || "";
  const L = parseInt(match[2]);
  const order = bondChar === "=" ? 2 : bondChar === "#" ? 3 : 1;
  return { order, L };
}
function processRingSymbol(symbol) {
  const basicMatch = symbol.match(/^\[(=|#)?Ring([1-3])\]$/);
  if (basicMatch) {
    const bondChar = basicMatch[1] || "";
    const L = parseInt(basicMatch[2]);
    const order = bondChar === "=" ? 2 : bondChar === "#" ? 3 : 1;
    return { order, L, stereo: null };
  }
  const stereoMatch = symbol.match(/^\[([-\\/])([-\\/])Ring([1-3])\]$/);
  if (stereoMatch) {
    const L = parseInt(stereoMatch[3]);
    return { order: 1, L, stereo: [stereoMatch[1], stereoMatch[2]] };
  }
  return null;
}
function nextAtomState(requestedBondOrder, bondingCapacity, state) {
  let actualBondOrder = requestedBondOrder;
  if (state === 0) {
    actualBondOrder = 0;
  } else {
    actualBondOrder = Math.min(requestedBondOrder, state, bondingCapacity);
  }
  const bondsLeft = bondingCapacity - actualBondOrder;
  const nextState = bondsLeft === 0 ? null : bondsLeft;
  return [actualBondOrder, nextState];
}
function nextBranchState(branchType, state) {
  if (state <= 1) {
    throw new Error("Branch requires state > 1");
  }
  const branchInitState = Math.min(state - 1, branchType);
  const nextState = state - branchInitState;
  return [branchInitState, nextState];
}
function nextRingState(ringType, state) {
  if (state === 0) {
    throw new Error("Ring requires state > 0");
  }
  const bondOrder = Math.min(ringType, state);
  const bondsLeft = state - bondOrder;
  const nextState = bondsLeft === 0 ? null : bondsLeft;
  return [bondOrder, nextState];
}
function getIndexFromSelfies(symbols) {
  let index = 0;
  const base = INDEX_ALPHABET.length;
  for (let i = 0; i < symbols.length; i++) {
    const symbolIndex = symbols.length - 1 - i;
    const code = INDEX_CODE[symbols[symbolIndex]] || 0;
    index += code * Math.pow(base, i);
  }
  return index;
}

// node_modules/selfies-js/src/decoder.js
function decode(selfies) {
  const ast = decodeToAST(selfies);
  return buildSmiles(ast.atoms, ast.bonds, ast.rings);
}
function decodeToAST(selfies) {
  const tokens = tokenize(selfies);
  const atoms = [];
  const bonds = [];
  const rings = [];
  let state = 0;
  let prevAtomIndex = null;
  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];
    const content = token.slice(1, -1);
    if (content === "nop") {
      i++;
      continue;
    }
    if (content.includes("Branch") || content.includes("ch")) {
      const branchInfo = processBranchSymbol(token);
      if (!branchInfo) {
        i++;
        continue;
      }
      if (state <= 1) {
        i++;
        continue;
      }
      const { order: branchOrder, L } = branchInfo;
      const [branchInitState, nextState] = nextBranchState(branchOrder, state);
      i++;
      if (i >= tokens.length) {
        state = nextState;
        break;
      }
      const Q = readIndexFromTokens(tokens, i, L);
      i += Q.consumed;
      const branchResult = deriveBranch(
        tokens,
        i,
        Q.value + 1,
        branchInitState,
        prevAtomIndex,
        atoms,
        bonds,
        rings
      );
      i += branchResult.consumed;
      state = nextState;
      if (i >= tokens.length) {
        break;
      }
      continue;
    }
    if (content.includes("Ring") || content.includes("ng")) {
      const ringInfo = processRingSymbol(token);
      if (!ringInfo) {
        i++;
        continue;
      }
      if (state === 0) {
        i++;
        continue;
      }
      const { order: requestedOrder, L } = ringInfo;
      const [bondOrder, nextState] = nextRingState(requestedOrder, state);
      i++;
      if (i >= tokens.length) {
        if (prevAtomIndex !== null && bonds.length > 0) {
          const lastBond = bonds[bonds.length - 1];
          lastBond.order = Math.min(lastBond.order + bondOrder, 3);
        }
        state = nextState;
        break;
      }
      const Q = readIndexFromTokens(tokens, i, L);
      i += Q.consumed;
      const targetIndex = Math.max(0, prevAtomIndex - (Q.value + 1));
      if (targetIndex === prevAtomIndex) {
        state = nextState;
        continue;
      }
      handleRingClosure(targetIndex, prevAtomIndex, bondOrder, bonds, rings);
      state = nextState;
      continue;
    }
    let atomInfo;
    try {
      atomInfo = parseAtomSymbol(content);
    } catch (error) {
      throw new Error(`Invalid SELFIES token ${token}: ${error.message}`);
    }
    if (atomInfo) {
      const { element, bondOrder: requestedBond, stereo } = atomInfo;
      const capacity = getBondingCapacity(element);
      const [actualBond, nextState] = nextAtomState(requestedBond, capacity, state);
      const atomIndex = atoms.length;
      atoms.push({ element, capacity, stereo });
      if (actualBond > 0 && prevAtomIndex !== null) {
        bonds.push({
          from: prevAtomIndex,
          to: atomIndex,
          order: actualBond
        });
      }
      state = nextState;
      prevAtomIndex = atomIndex;
      if (state === null) {
        i++;
        break;
      }
    }
    i++;
  }
  return { atoms, bonds, rings };
}
function handleRingClosure(targetIndex, prevAtomIndex, bondOrder, bonds, rings) {
  const existingBond = bonds.find(
    (b) => b.from === targetIndex && b.to === prevAtomIndex || b.from === prevAtomIndex && b.to === targetIndex
  );
  if (existingBond) {
    existingBond.order = Math.min(existingBond.order + bondOrder, 3);
  } else {
    const existingRing = rings.find(
      (r) => r.from === targetIndex && r.to === prevAtomIndex || r.from === prevAtomIndex && r.to === targetIndex
    );
    if (existingRing) {
      existingRing.order = Math.min(existingRing.order + bondOrder, 3);
    } else {
      rings.push({
        from: targetIndex,
        to: prevAtomIndex,
        order: bondOrder
      });
    }
  }
}
function readIndexFromTokens(tokens, startIndex, numTokens = 1) {
  if (startIndex >= tokens.length) {
    return { value: 0, consumed: 0 };
  }
  const symbols = [];
  let i = startIndex;
  while (i < tokens.length && symbols.length < numTokens) {
    const symbol = tokens[i];
    if (INDEX_CODE.hasOwnProperty(symbol)) {
      symbols.push(symbol);
      i++;
    } else {
      symbols.push(null);
      i++;
    }
  }
  if (symbols.length === 0) {
    return { value: 0, consumed: 0 };
  }
  const value = getIndexFromSelfies(symbols);
  return { value, consumed: symbols.length };
}
function deriveBranch(tokens, startIndex, maxDerive, initState, rootAtom, atoms, bonds, rings) {
  let state = initState;
  let prevAtomIndex = rootAtom;
  let consumed = 0;
  let derived = 0;
  while (consumed < tokens.length - startIndex && derived < maxDerive) {
    if (state === null || state === 0) break;
    const token = tokens[startIndex + consumed];
    const content = token.slice(1, -1);
    if (content.includes("Ring") || content.includes("ng")) {
      const ringInfo = processRingSymbol(token);
      if (!ringInfo) {
        throw new Error(`Invalid ring token in branch: ${token}`);
      }
      if (state === 0) {
        throw new Error(`Ring ${token} at invalid state 0 inside branch`);
      }
      const { order: requestedOrder, L } = ringInfo;
      const [bondOrder, nextState2] = nextRingState(requestedOrder, state);
      consumed++;
      derived++;
      if (consumed >= tokens.length - startIndex) {
        state = nextState2;
        break;
      }
      const Q = readIndexFromTokens(tokens, startIndex + consumed, L);
      consumed += Q.consumed;
      derived += Q.consumed;
      const targetIndex = Math.max(0, prevAtomIndex - (Q.value + 1));
      if (targetIndex !== prevAtomIndex) {
        handleRingClosure(targetIndex, prevAtomIndex, bondOrder, bonds, rings);
      }
      state = nextState2;
      continue;
    }
    if (content.includes("Branch") || content.includes("ch")) {
      const branchInfo = processBranchSymbol(token);
      if (!branchInfo) {
        throw new Error(`Invalid branch token in branch: ${token}`);
      }
      if (state <= 1) {
        throw new Error(`Branch ${token} at invalid state ${state} inside branch`);
      }
      const { order: branchOrder, L } = branchInfo;
      const [branchInitState, nextState2] = nextBranchState(branchOrder, state);
      consumed++;
      derived++;
      if (consumed >= tokens.length - startIndex) {
        state = nextState2;
        break;
      }
      const Q = readIndexFromTokens(tokens, startIndex + consumed, L);
      consumed += Q.consumed;
      derived += Q.consumed;
      const nestedResult = deriveBranch(
        tokens,
        startIndex + consumed,
        Q.value + 1,
        branchInitState,
        prevAtomIndex,
        atoms,
        bonds,
        rings
      );
      consumed += nestedResult.consumed;
      derived += nestedResult.derived;
      state = nextState2;
      continue;
    }
    let atomInfo;
    try {
      atomInfo = parseAtomSymbol(content);
    } catch (error) {
      throw new Error(`Invalid branch atom [${content}]: ${error.message}`);
    }
    if (!atomInfo) {
      consumed++;
      continue;
    }
    const { element, bondOrder: requestedBond, stereo } = atomInfo;
    const capacity = getBondingCapacity(element);
    const [actualBond, nextState] = nextAtomState(requestedBond, capacity, state);
    const atomIndex = atoms.length;
    atoms.push({ element, capacity, stereo });
    if (actualBond > 0 && prevAtomIndex !== null) {
      bonds.push({
        from: prevAtomIndex,
        to: atomIndex,
        order: actualBond
      });
    }
    state = nextState;
    prevAtomIndex = atomIndex;
    derived++;
    consumed++;
  }
  return { consumed, derived };
}
function parseAtomSymbol(content) {
  let bondOrder = 1;
  let element = content;
  let stereo = null;
  if (content.startsWith("=")) {
    bondOrder = 2;
    element = content.slice(1);
  } else if (content.startsWith("#")) {
    bondOrder = 3;
    element = content.slice(1);
  } else if (content.startsWith("/") || content.startsWith("\\")) {
    element = content.slice(1);
  }
  if (element.includes("@")) {
    stereo = element;
    const match = element.match(/^([A-Z][a-z]?)/);
    if (match) {
      element = match[1];
    }
  }
  const validElements = [
    "C",
    "N",
    "O",
    "S",
    "P",
    "F",
    "Cl",
    "Br",
    "I",
    "B",
    "H",
    "Si",
    "As",
    "Se",
    "Te",
    "Al",
    "Ga",
    "Ge",
    "Sn",
    "Pb",
    "Li",
    "Na",
    "K",
    "Mg",
    "Ca",
    "Zn",
    "Fe",
    "Cu",
    "Ni",
    "Co",
    "Mn",
    "Cr",
    "V",
    "Ti",
    "Sc"
  ];
  if (!validElements.includes(element)) {
    return null;
  }
  return { element, bondOrder, stereo };
}
function assignRingNumbers(rings) {
  const ringNumbers = /* @__PURE__ */ new Map();
  let nextRingNum = 1;
  for (const ring of rings) {
    if (!ringNumbers.has(`${ring.from}-${ring.to}`)) {
      ringNumbers.set(`${ring.from}-${ring.to}`, nextRingNum);
      ringNumbers.set(`${ring.to}-${ring.from}`, nextRingNum);
      nextRingNum++;
    }
  }
  return ringNumbers;
}
function buildAdjacencyList(atoms, bonds) {
  const adj = /* @__PURE__ */ new Map();
  for (let i = 0; i < atoms.length; i++) {
    adj.set(i, []);
  }
  for (const bond of bonds) {
    adj.get(bond.from).push({ to: bond.to, order: bond.order });
    adj.get(bond.to).push({ to: bond.from, order: bond.order });
  }
  return adj;
}
function writeBondSymbol(bondOrder, smiles) {
  if (bondOrder === 2) smiles.push("=");
  if (bondOrder === 3) smiles.push("#");
}
function writeRingClosures(atomIndex, rings, ringNumbers, visited, smiles) {
  for (const ring of rings) {
    const isFrom = ring.from === atomIndex;
    const isTo = ring.to === atomIndex;
    if (isFrom && visited.has(ring.to)) {
      const ringNum = ringNumbers.get(`${atomIndex}-${ring.to}`);
      writeBondSymbol(ring.order, smiles);
      smiles.push(ringNum.toString());
    } else if (isTo && visited.has(ring.from)) {
      const ringNum = ringNumbers.get(`${ring.from}-${atomIndex}`);
      writeBondSymbol(ring.order, smiles);
      smiles.push(ringNum.toString());
    } else if (isFrom && !visited.has(ring.to) || isTo && !visited.has(ring.from)) {
      const ringNum = isFrom ? ringNumbers.get(`${atomIndex}-${ring.to}`) : ringNumbers.get(`${ring.from}-${atomIndex}`);
      writeBondSymbol(ring.order, smiles);
      smiles.push(ringNum.toString());
    }
  }
}
function writeAtomSymbol(atom, smiles) {
  if (atom.stereo) {
    smiles.push(`[${atom.stereo}]`);
  } else {
    smiles.push(atom.element);
  }
}
function buildSmiles(atoms, bonds, rings) {
  if (atoms.length === 0) return "";
  const smiles = [];
  const visited = /* @__PURE__ */ new Set();
  const ringNumbers = assignRingNumbers(rings);
  const adj = buildAdjacencyList(atoms, bonds);
  function dfs(atomIndex, parentIndex = null) {
    if (visited.has(atomIndex)) return;
    visited.add(atomIndex);
    const atom = atoms[atomIndex];
    writeAtomSymbol(atom, smiles);
    writeRingClosures(atomIndex, rings, ringNumbers, visited, smiles);
    const neighbors = adj.get(atomIndex) || [];
    const unvisited = neighbors.filter((n) => !visited.has(n.to) && n.to !== parentIndex);
    for (let i = 0; i < unvisited.length; i++) {
      const neighbor = unvisited[i];
      if (i < unvisited.length - 1) {
        smiles.push("(");
      }
      writeBondSymbol(neighbor.order, smiles);
      dfs(neighbor.to, atomIndex);
      if (i < unvisited.length - 1) {
        smiles.push(")");
      }
    }
  }
  dfs(0);
  return smiles.join("");
}
export {
  decode
};
