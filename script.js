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
const EVADE_EDGE_MARGIN_PX = 16;
const EVADE_MIN_JUMP_CARD_MULTIPLES = 2;
const EVADE_PLACEMENT_ATTEMPTS = 30;
const EVADE_ARM_DELAY_MS = 300;
const NO_TEXTS = [
  "No",
  "Are you sure? \u{1F914}",
  "Really sure? \u{1F613}",
  "Pretty please??? \u{1F614}",
  "I'm going to cry if you say no \u{1F972}",
  "Last chance~ \u{1F62D}",
];
const NO_IMAGES = [
  "images/no-0.gif",
  "images/no-1.gif",
  "images/no-2.gif",
  "images/no-3.gif",
  "images/no-4.gif",
  "images/no-5.gif",
];
const YES_IMAGE = "images/yes.webp";

let stage = 0;
let evadeArmTimeoutId = null;
let yesNaturalWidth = 0;

const yesButton = document.getElementById("yes-btn");
const noButton = document.getElementById("no-btn");
const buttonStage = document.getElementById("button-stage");
const question = document.getElementById("question");
const ending = document.getElementById("ending");
const imageStage = document.getElementById("image-stage");
const stageImage = document.getElementById("stage-image");
const endingImage = document.getElementById("ending-image");
const measureContext = document.createElement("canvas").getContext("2d");

/**
 * Measure the rendered width of a No button label at a given font size.
 *
 * Parameters
 * ----------
 * text : string
 *     Label to measure.
 * fontPx : number
 *     Font size, in pixels, to measure the text at.
 *
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
 *
 * Parameters
 * ----------
 * start : number
 *     Value at progress 0.
 * end : number
 *     Value at progress 1.
 * progress : number
 *     Fraction between 0 and 1.
 *
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
 *
 * The No button is anchored to the right edge of the Yes button, with
 * its own left edge as the positioning reference, so it always sits
 * immediately beside Yes regardless of how large Yes has grown. Since
 * the No button text no longer wraps, its font size is also clamped so
 * that the unwrapped label always fits between Yes and the right edge
 * of the screen.
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
  stageImage.src = NO_IMAGES[stage];
}

/**
 * Compute a random viewport position for the No button to evade to.
 *
 * The position is chosen anywhere on screen, including over the
 * question, the image, or the Yes button, since the button is
 * repositioned with `position: fixed` once evading. The only
 * constraint is a minimum jump distance of twice the card's longest
 * side from its current position, so every jump is a noticeable hop
 * rather than a short shuffle; any direction and any overlap is
 * otherwise acceptable. If no sampled position meets that minimum
 * within the attempt budget, the last sampled position is used.
 *
 * Returns
 * -------
 * object
 *     Object with `leftPercent` and `topPercent` properties, expressed
 *     as percentages of the viewport.
 */
function randomNoPosition() {
  const noRect = noButton.getBoundingClientRect();
  const halfWidth = noRect.width / 2;
  const halfHeight = noRect.height / 2;
  const prevCenterX = noRect.left + halfWidth;
  const prevCenterY = noRect.top + halfHeight;
  const minJumpDistance = Math.max(noRect.width, noRect.height) * EVADE_MIN_JUMP_CARD_MULTIPLES;

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const minCenterX = halfWidth + EVADE_EDGE_MARGIN_PX;
  const maxCenterX = viewportWidth - halfWidth - EVADE_EDGE_MARGIN_PX;
  const minCenterY = halfHeight + EVADE_EDGE_MARGIN_PX;
  const maxCenterY = viewportHeight - halfHeight - EVADE_EDGE_MARGIN_PX;

  let centerX = prevCenterX;
  let centerY = prevCenterY;
  for (let attempt = 0; attempt < EVADE_PLACEMENT_ATTEMPTS; attempt += 1) {
    centerX = lerp(minCenterX, maxCenterX, Math.random());
    centerY = lerp(minCenterY, maxCenterY, Math.random());
    if (Math.hypot(centerX - prevCenterX, centerY - prevCenterY) >= minJumpDistance) {
      break;
    }
  }

  return {
    leftPercent: (centerX / viewportWidth) * 100,
    topPercent: (centerY / viewportHeight) * 100,
  };
}

/**
 * Move the No button to a new random position to evade the cursor.
 *
 * Switches the button to `position: fixed` so it can be placed
 * anywhere in the viewport, rather than being confined to the
 * button stage it started in.
 */
function evadeCursor() {
  const position = randomNoPosition();
  noButton.style.position = "fixed";
  noButton.style.left = `${position.leftPercent}%`;
  noButton.style.top = `${position.topPercent}%`;
  noButton.style.transformOrigin = "center";
  noButton.style.transform = `translate(-50%, -50%) scale(${NO_END_SCALE})`;
}

/**
 * Handle a click on the No button.
 */
function handleNoClick() {
  if (stage >= MAX_STAGE) {
    evadeCursor();
    return;
  }
  stage += 1;
  applyStageVisuals();
  if (stage >= MAX_STAGE) {
    evadeArmTimeoutId = setTimeout(() => {
      noButton.addEventListener("mouseenter", evadeCursor);
    }, EVADE_ARM_DELAY_MS);
  }
}

/**
 * Handle a click on the Yes button by ending the interaction.
 *
 * Cancels the pending evade-listener timer in case Yes is clicked
 * before it fires, since otherwise the listener would be attached to
 * the No button after the interaction has already ended.
 */
function handleYesClick() {
  clearTimeout(evadeArmTimeoutId);
  noButton.removeEventListener("mouseenter", evadeCursor);
  buttonStage.classList.add("hidden");
  question.classList.add("hidden");
  imageStage.classList.add("hidden");
  endingImage.src = YES_IMAGE;
  ending.classList.remove("hidden");
}

/**
 * Wire up event listeners and set the initial visual state.
 *
 * Applies the initial layout immediately so there is no flash of
 * unpositioned content, then re-applies it once the Fredoka webfont
 * has finished loading so the canvas based text measurements used for
 * No button sizing match what is actually rendered on screen.
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
