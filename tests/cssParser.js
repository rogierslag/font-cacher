const fs = require("fs");
const parseCss = require("../src/cssParser");

function unicodeSimpleChromeWithSwapAndExtendedSubset() {
  const simpleChromeWithSwapAndExtendedSubsetCss = fs
    .readFileSync(
      `${__dirname}/cssResources/simpleChromeWithSwapAndExtendedSubset.css`
    )
    .toString();
  const parsed = parseCss(simpleChromeWithSwapAndExtendedSubsetCss);
  console.assert(
    parsed.length === 1,
    "Length was not correct, got %d for %s",
    parsed.length,
    "chromeWithSwapAndExtendedSubset"
  );
  const foundResource = parsed.find(
    (e) =>
      e.key === "latin" &&
      e.fontStyle === "italic" &&
      e.fontDisplay === "swap" &&
      e.fontWeight === "400"
  );

  const unicodeSimple = foundResource.unicodeRanges.find(
    (e) => e.from === "0131"
  );
  const unicodeWildcard = foundResource.unicodeRanges.find(
    (e) => e.from === "0010"
  );
  const unicodeRange = foundResource.unicodeRanges.find(
    (e) => e.from === "0152"
  );
  console.assert(
    Object.keys(unicodeSimple).length === 2 && unicodeSimple.to === "0131",
    "Did not get expected simple unicode range for %s",
    "simpleChromeWithSwapAndExtendedSubset"
  );
  console.assert(
    Object.keys(unicodeWildcard).length === 2 && unicodeWildcard.to === "0019",
    "Did not get expected wildcard unicode range for %s",
    "simpleChromeWithSwapAndExtendedSubset"
  );
  console.assert(
    Object.keys(unicodeRange).length === 2 && unicodeRange.to === "0153",
    "Did not get expected unicode range for %s",
    "simpleChromeWithSwapAndExtendedSubset"
  );
}

function chromeWithSwapAndExtendedSubset() {
  const chromeWithSwapAndExtendedSubsetCss = fs
    .readFileSync(
      `${__dirname}/cssResources/chromeWithSwapAndExtendedSubset.css`
    )
    .toString();
  const parsed = parseCss(chromeWithSwapAndExtendedSubsetCss);
  console.assert(
    parsed.length === 35,
    "Length was not correct, got %d for %s",
    parsed.length,
    "chromeWithSwapAndExtendedSubset"
  );
  const foundSource = parsed.find(
    (e) =>
      e.key === "latin" &&
      e.fontStyle === "italic" &&
      e.fontDisplay === "swap" &&
      e.fontWeight === "400"
  ).remoteSrc;
  console.assert(
    foundSource ===
      "https://fonts.gstatic.com/s/sourcesanspro/v13/6xK1dSBYKcSV-LCoeQqfX1RYOo3qPZ7nsDJB9cme.woff2",
    "Did not get expected font file for %s",
    "chromeWithSwapAndExtendedSubset"
  );
}

function chromeWithSwapAndSubset() {
  const chromeWithSwapAndSubsetCss = fs
    .readFileSync(`${__dirname}/cssResources/chromeWithSwapAndSubset.css`)
    .toString();
  const parsed = parseCss(chromeWithSwapAndSubsetCss);
  console.assert(
    parsed.length === 35,
    "Length was not correct, got %d for %s",
    parsed.length,
    "chromeWithSwapAndSubset"
  );
  const foundSource = parsed.find(
    (e) =>
      e.key === "latin" &&
      e.fontStyle === "italic" &&
      e.fontDisplay === "swap" &&
      e.fontWeight === "400"
  ).remoteSrc;
  console.assert(
    foundSource ===
      "https://fonts.gstatic.com/s/sourcesanspro/v13/6xK1dSBYKcSV-LCoeQqfX1RYOo3qPZ7nsDJB9cme.woff2",
    "Did not get expected font file for %s",
    "chromeWithSwapAndSubset"
  );
}

function simpleMsie11() {
  const simpleMsie11Css = fs
    .readFileSync(`${__dirname}/cssResources/simpleMsie11.css`)
    .toString();
  const parsed = parseCss(simpleMsie11Css);
  console.assert(
    parsed.length === 1,
    "Length was not correct, got %d for %s",
    parsed.length,
    "simpleMsie11"
  );
  const foundSource = parsed.find(
    (e) => e.key === null && e.fontStyle === "normal" && e.fontWeight === "300"
  ).remoteSrc;
  console.assert(
    foundSource ===
      "https://fonts.gstatic.com/s/sourcesanspro/v13/6xKydSBYKcSV-LCoeQqfX1RYOo3ik4zwlxdo.woff",
    "Did not get expected font file for %s",
    "simpleMsie11"
  );
}

function msie11() {
  const simpleMsie11Css = fs
    .readFileSync(`${__dirname}/cssResources/msie11.css`)
    .toString();
  const parsed = parseCss(simpleMsie11Css);
  console.assert(
    parsed.length === 5,
    "Length was not correct, got %d for %s",
    parsed.length,
    "msie11"
  );
  const foundSource = parsed.find(
    (e) => e.key === null && e.fontStyle === "normal" && e.fontWeight === "700"
  ).remoteSrc;
  console.assert(
    foundSource ===
      "https://fonts.gstatic.com/s/sourcesanspro/v13/6xKydSBYKcSV-LCoeQqfX1RYOo3ig4vwmRdo.woff",
    "Did not get expected font file for %s",
    "msie11"
  );
}

function scrambled() {
  const simpleMsie11Css = fs
    .readFileSync(`${__dirname}/cssResources/scrambledFile.css`)
    .toString();
  const parsed = parseCss(simpleMsie11Css);
  console.assert(
    parsed.length === 1,
    "Length was not correct, got %d for %s",
    parsed.length,
    "crambled"
  );
  console.assert(
    parsed[0].key === "key is here",
    "Key was not correct for crambled"
  );
  console.assert(
    parsed[0].fontFamily === "Source Sans Pro",
    "fontFamily was not correct for crambled"
  );
  console.assert(
    parsed[0].fontStyle === "normal",
    "fontStyle was not correct for crambled"
  );
  console.assert(
    parsed[0].fontWeight === "300",
    "fontWeight was not correct for crambled"
  );
  console.assert(
    parsed[0].remoteSrc ===
      "https://fonts.gstatic.com/s/sourcesanspro/v13/6xKydSBYKcSV-LCoeQqfX1RYOo3ik4zwlxdo.woff",
    "remoteSrc was not correct for crambled"
  );
}

unicodeSimpleChromeWithSwapAndExtendedSubset();
chromeWithSwapAndExtendedSubset();
chromeWithSwapAndSubset();
simpleMsie11();
msie11();
scrambled();

console.log("If no errors appeared above this line, all is well!");
