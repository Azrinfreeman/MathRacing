# Manual five-finger touch test

Automated browser tests cannot prove that five real children can touch a real panel at once. The Playwright suite does drive five simultaneous touch points through Chrome DevTools Protocol, which exercises the same pointer-ownership code, but **that is not hardware evidence**. Run this protocol on each target interactive panel before classroom use, and record the result at the bottom.

## What you need

- The target panel (Windows interactive display) and the browser that will be used in class (Chrome or Edge).
- Five people (adults are fine) or five fingers of two hands.
- The app served from a development machine so the diagnostic overlay is available: `npm run dev -- --host`, then open `http://<dev-machine-ip>:5173/?diag` on the panel. (The overlay exists only in development builds; a production build never shows it.)
- Screen at its native resolution, browser zoom 100%, full screen (F11).

## Setup

1. Open the app with `?diag`. Choose Year 1, topic 2.0 Operasi Asas, level 1, **5 players**, Lumba Pantas, 8 answers, and type nicknames (for example A to E).
2. Press **Mula**. In the top-left of the canvas you should now see `DEV pointers: 0/10 active slots`.

## Test 1: five touches on the Ready screen

1. Five people each touch their own **Sentuh kotak anda** button at the same moment.
2. Expected: the diagnostic lists five rows, `pointer N -> p1` … `pointer M -> p5`, each pointer id mapped to a different panel. All five buttons turn green (Sedia) when lifted. The countdown starts by itself.
3. Fail if fewer than five buttons confirm, if two pointers map to the same panel, or if the diagnostic shows more than five owners for five fingers.

## Test 2: five simultaneous answers (repeat 10 times)

1. During the race each person taps their digits and **Hantar** at the same time.
2. Expected: each panel only ever shows that person's own digits; each racer moves only for that panel's correct answer.
3. Fail if a digit appears in a neighbouring panel, if two racers move for one tap, or if a tap is lost every time.

## Test 3: slide-in and slide-across

1. Type the correct answer on panel 3 but do not press Hantar.
2. Put a finger down on the track (above the panels), slide it onto panel 3's **Hantar**, and lift.
3. Put a finger down on a digit in panel 2, slide it across onto panel 3's **Hantar**, and lift.
4. Expected: nothing is submitted by either slide. Then tap panel 3's own Hantar normally: it submits.

## Test 4: extra contacts

1. While five people touch normally, rest a palm or extra fingers on the frame or on empty track areas.
2. Expected: the five pupils' touches still work; extra contacts never act on a panel.

## Test 5: ten-minute soak

1. Run a Latihan (practice) race with 12 answers and answer continuously for 10 minutes across several races (Main Lagi).
2. Expected: no crossed input, no frozen panel, no growing lag, the diagnostic returns to `0` pointers when nobody is touching.

## Test 6: display and readability

1. Stand where a pupil stands. Every panel, number, name and racer must be readable without clipping. Note the smallest physical key size (measure a key with a ruler: target keys >= 18-20 mm, Hantar >= 24 mm where space allows).

## Record the result

| Date | Panel model | OS / browser | Native touch points reported by the panel | Test 1      | Test 2      | Test 3      | Test 4      | Test 5      | Test 6 (key size mm) | Notes / observer |
| ---- | ----------- | ------------ | ----------------------------------------- | ----------- | ----------- | ----------- | ----------- | ----------- | -------------------- | ---------------- |
|      |             |              |                                           | pass / fail | pass / fail | pass / fail | pass / fail | pass / fail |                      |                  |

If a panel reports fewer than five simultaneous touch points, use the 2-3 player layout on that panel (the layout scales to the number of players) and record the limitation.
