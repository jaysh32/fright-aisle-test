DROP-IN REPLACEMENT MODELS
==========================

Put downloaded models (.glb or .fbx, e.g. from Mixamo) in this folder, then list
them in manifest.json. Each entry replaces one display's built-in figure and
keeps its pad, spotlight, sounds, price sign and scare rating.

This only works when the game is started with "Play Fright Aisle.bat" (browsers
will not load model files when index.html is opened by double-click).

Example manifest.json
---------------------
{
  "Grave Grabber": {
    "file": "zombie.fbx",
    "animations": ["Zombie Stand Up.fbx", "Zombie Scream.fbx", "Zombie Attack.fbx"],
    "height": 1.8,
    "rest": "Zombie Stand Up",
    "show": [[0.3, "Zombie Stand Up"], [4, "Zombie Scream"], [6.5, "Zombie Attack"]]
  }
}

Fields
------
"Grave Grabber"   The display's name exactly as on its price sign.
file              The character model (for Mixamo: download "With Skin").
animations        Extra animation files (for Mixamo: "Without Skin" is fine).
                  Each clip is named after its file, without the extension.
                  Or use {"clipName": "file.fbx"} to choose the clip's name.
                  Mixamo characters share one skeleton, so a clip downloaded
                  with one character also plays on the others.
clip              Name to give the animation that came inside the main file.
once              Clip names that play once and hold, instead of looping.
height            Height in metres the model is scaled to.
rest              Clip whose first frame is held while the display is idle.
show              [seconds, clip name] pairs: which clip starts when, after the
                  pad is stepped on.
dur               Optional. Length of the show in seconds.
offset, rotY      Optional. Nudge [x, y, z] in metres / turn in radians.
keepOriginal      Optional. true keeps the built-in figure visible as well.
roughness         Optional. 0 = glossy, 1 = matte (default 0.75).

The browser console (F12) lists the clip names found in each model.
