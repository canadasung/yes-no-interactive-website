/*
Behaviour for the Yes/No interactive website.

Controls the growth of the Yes button, the shrinking of the No button,
the evasive movement of the No button after five No clicks, and the
transition to the closing screen when Yes is clicked.
*/

const MAX_STAGE = 5;
const YES_START_LEFT = 40;
const YES_END_LEFT = 50;
const YES_START_SCALE = 1;
const YES_END_SCALE = 2.2;
const NO_GAP_PX = 24;
const NO_RIGHT_MARGIN_PX = 16;
const NO_MIN_FONT_PX = 14;
const NO_HORIZONTAL_PADDING_EM = 2.16;
const NO_START_SCALE = 0.7;
const NO_END_SCALE = 0.3;
const NO_START_FONT_REM = 5;
const NO_END_FONT_REM = 4.32;
const ROOT_FONT_PX = 16;
const EVADE_MIN_LEFT = 10;
const EVADE_MAX_LEFT = 90;
const EVADE_MIN_TOP = 15;
const EVADE_MAX_TOP = 85;
const EVADE_MARGIN_PX = 24;
const EVADE_ARM_DELAY_MS = 300;
const NO_TEXTS = [
  "No",
  "Are you sure? \u{1F914}",
  "Really sure? \u{1F613}",
  "Pretty please??? \u{1F614}",
  "I'm going to cry if you say no \u{1F972}",
  "Last chance~ \u{1F62D}",
];

let stage = 0;
let evading = false;
let yesNaturalWidth = 0;

const yesButton = document.getElementById("yes-btn");
const noButton = document.getElementById("no-btn");
const buttonStage = document.getElementById("button-stage");
const ending = document.getElementById("ending");
const measureContext = document.createElement("canvas").getContext("2d");

/**
 * Measure the rendered width of a No button label at a given font size.

 * Parameters
 * ----------
 * text : string
 *     Label to measure.
 * fontPx : number
 *     Font size, in pixels, to measure the text at.

 * Returns
 * -------
 * number
 *     Rendered text width, in pixels.
 */
function measureTextWidthPx(text, fontPx) {
  measureContext.font = `bold ${fontPx}px "Fredoka", Arial, sans-serif`;
  return measureContext.measureText(text).width;
}

/**
 * Linearly interpolate between two values.

 * Parameters
 * ----------
 * start : number
 *     Value at progress 0.
 * end : number
 *     Value at progress 1.
 * progress : number
 *     Fraction between 0 and 1.

 * Returns
 * -------
 * number
 *     Interpolated value.
 */
function lerp(start, end, progress) {
  return start + (end - start) * progress;
}

/**
 * Apply the Yes and No button positions and sizes for the current stage.

 * The No button is anchored to the right edge of the Yes button, with
 * its own left edge as the positioning reference, so it always sits
 * immediately beside Yes regardless of how large Yes has grown. Since
 * the No button text no longer wraps, its font size is also clamped so
 * that the unwrapped label always fits between Yes and the right edge
 * of the screen.

 * Parameters
 * ----------
 * None

 * Returns
 * -------
 * None
 */
function applyStageVisuals() {
  const progress = stage / MAX_STAGE;
  const yesLeft = lerp(YES_START_LEFT, YES_END_LEFT, progress);
  const yesScale = lerp(YES_START_SCALE, YES_END_SCALE, progress);
  const noScale = lerp(NO_START_SCALE, NO_END_SCALE, progress);
  const noScheduledFontPx = lerp(NO_START_FONT_REM, NO_END_FONT_REM, progress) * ROOT_FONT_PX;
  const noText = NO_TEXTS[stage];

  yesButton.style.left = `${yesLeft}%`;
  yesButton.style.top = "50%";
  yesButton.style.transform = `translate(-50%, -50%) scale(${yesScale})`;

  if (yesNaturalWidth === 0) {
    yesNaturalWidth = yesButton.getBoundingClientRect().width;
  }
  const stageWidth = buttonStage.getBoundingClientRect().width;
  const yesWidthPercent = ((yesNaturalWidth * yesScale) / stageWidth) * 100;
  const noGapPercent = (NO_GAP_PX / stageWidth) * 100;
  const noLeft = yesLeft + yesWidthPercent / 2 + noGapPercent;

  const noLeftPx = (noLeft / 100) * stageWidth;
  const availableWidthPx = stageWidth - noLeftPx - NO_RIGHT_MARGIN_PX;
  const referenceFontPx = 100;
  const referenceTextWidthPx = measureTextWidthPx(noText, referenceFontPx);
  const widthPerFontPx = referenceTextWidthPx / referenceFontPx + NO_HORIZONTAL_PADDING_EM;
  const fittedFontPx = availableWidthPx / (widthPerFontPx * noScale);
  const noFontPx = Math.max(NO_MIN_FONT_PX, Math.min(noScheduledFontPx, fittedFontPx));

  noButton.style.left = `${noLeft}%`;
  noButton.style.top = "50%";
  noButton.style.transformOrigin = "left center";
  noButton.style.transform = `translate(0, -50%) scale(${noScale})`;
  noButton.style.fontSize = `${noFontPx}px`;
  noButton.textContent = noText;
}

/**
 * Determine whether two axis-aligned rectangles overlap.

 * Parameters
 * ----------
 * a : object
 *     Rectangle with `left`, `right`, `top`, and `bottom` in pixels.
 * b : object
 *     Rectangle with `left`, `right`, `top`, and `bottom` in pixels.
 * margin : number
 *     Minimum pixel gap required between the two rectangles.

 * Returns
 * -------
 * boolean
 *     True if the rectangles overlap, including the margin.
 */
function rectsOverlap(a, b, margin) {
  return !(
    a.right + margin < b.left ||
    a.left - margin > b.right ||
    a.bottom + margin < b.top ||
    a.top - margin > b.bottom
  );
}

/**
 * Compute a random position for the No button that does not overlap Yes.

 * Parameters
 * ----------
 * None

 * Returns
 * -------
 * object
 *     Object with `left` and `top` properties, expressed as percentages.
 */
function randomNoPosition() {
  const stageRect = buttonStage.getBoundingClientRect();
  const yesRect = yesButton.getBoundingClientRect();
  const noRect = noButton.getBoundingClientRect();
  const halfWidth = noRect.width / 2;
  const halfHeight = noRect.height / 2;

  let left;
  let top;
  let candidate;
  do {
    left = lerp(EVADE_MIN_LEFT, EVADE_MAX_LEFT, Math.random());
    top = lerp(EVADE_MIN_TOP, EVADE_MAX_TOP, Math.random());
    const centerX = stageRect.left + (left / 100) * stageRect.width;
    const centerY = stageRect.top + (top / 100) * stageRect.height;
    candidate = {
      left: centerX - halfWidth,
      right: centerX + halfWidth,
      top: centerY - halfHeight,
      bottom: centerY + halfHeight,
    };
  } while (rectsOverlap(candidate, yesRect, EVADE_MARGIN_PX));
  return { left, top };
}

/**
 * Move the No button to a new random position to evade the cursor.

 * Parameters
 * ----------
 * None

 * Returns
 * -------
 * None
 */
function evadeCursor() {
  const position = randomNoPosition();
  noButton.style.left = `${position.left}%`;
  noButton.style.top = `${position.top}%`;
  noButton.style.transformOrigin = "center";
  noButton.style.transform = `translate(-50%, -50%) scale(${NO_END_SCALE})`;
}

/**
 * Handle a click on the No button.

 * Parameters
 * ----------
 * None

 * Returns
 * -------
 * None
 */
function handleNoClick() {
  if (stage >= MAX_STAGE) {
    evadeCursor();
    return;
  }
  stage += 1;
  applyStageVisuals();
  if (stage >= MAX_STAGE) {
    evading = true;
    setTimeout(() => {
      noButton.addEventListener("mouseenter", evadeCursor);
    }, EVADE_ARM_DELAY_MS);
  }
}

/**
 * Handle a click on the Yes button by ending the interaction.

 * Parameters
 * ----------
 * None

 * Returns
 * -------
 * None
 */
function handleYesClick() {
  if (evading) {
    noButton.removeEventListener("mouseenter", evadeCursor);
  }
  buttonStage.classList.add("hidden");
  document.getElementById("question").classList.add("hidden");
  ending.classList.remove("hidden");
}

/**
 * Wire up event listeners and set the initial visual state.

 * Applies the initial layout immediately so there is no flash of
 * unpositioned content, then re-applies it once the Fredoka webfont
 * has finished loading so the canvas based text measurements used for
 * No button sizing match what is actually rendered on screen.

 * Parameters
 * ----------
 * None

 * Returns
 * -------
 * None
 */
function init() {
  applyStageVisuals();
  document.fonts.ready.then(() => {
    applyStageVisuals();
  });
  noButton.addEventListener("click", handleNoClick);
  yesButton.addEventListener("click", handleYesClick);
}

document.addEventListener("DOMContentLoaded", init);
