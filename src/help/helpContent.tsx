import type { ReactNode } from 'react'
import type { EditorType } from '../types'

export interface HelpSection {
  title: string
  content: ReactNode
}

// ─── Shared primitives ────────────────────────────────────────────────────────

function H(t: string) {
  return <h3 className="text-indigo-300 font-semibold text-sm mt-4 mb-1 first:mt-0">{t}</h3>
}

function P({ children }: { children: ReactNode }) {
  return <p className="text-gray-300 text-sm leading-relaxed mb-2">{children}</p>
}

function Li({ children }: { children: ReactNode }) {
  return (
    <li className="text-gray-300 text-sm leading-relaxed flex gap-2">
      <span className="text-indigo-400 shrink-0">•</span>
      <span>{children}</span>
    </li>
  )
}

function Ul({ children }: { children: ReactNode }) {
  return <ul className="space-y-1 mb-3">{children}</ul>
}

function Tip({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-2 p-3 rounded-lg bg-indigo-900/30 border border-indigo-700/40 text-sm text-indigo-200 mb-3">
      <span className="text-indigo-400 shrink-0">💡</span>
      <span>{children}</span>
    </div>
  )
}

function Warn({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-2 p-3 rounded-lg bg-yellow-900/25 border border-yellow-700/40 text-sm text-yellow-200 mb-3">
      <span className="shrink-0">⚠️</span>
      <span>{children}</span>
    </div>
  )
}

function Code({ children }: { children: ReactNode }) {
  return (
    <code className="px-1.5 py-0.5 rounded bg-gray-800 text-indigo-300 text-xs font-mono">
      {children}
    </code>
  )
}

function Table({ rows }: { rows: [string, string][] }) {
  return (
    <table className="w-full text-sm mb-3 border-collapse">
      <tbody>
        {rows.map(([label, value], i) => (
          <tr key={i} className="border-b border-gray-700/50">
            <td className="py-1.5 pr-4 text-gray-400 font-medium whitespace-nowrap w-36">{label}</td>
            <td className="py-1.5 text-gray-200">{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ─── Help content per editor ──────────────────────────────────────────────────

export const HELP_CONTENT: Record<EditorType, HelpSection> = {
  scene: {
    title: 'Scene Editor',
    content: (
      <>
        <P>
          The Scene Editor is the main canvas where you visually design each game scene. Place
          backgrounds, sprites, characters, items, and hotspots, then position and resize them
          to build your game world.
        </P>

        {H('Canvas controls')}
        <Ul>
          <Li>Click an object on the canvas to select it — handles appear for drag and resize.</Li>
          <Li>Drag selected objects to reposition them.</Li>
          <Li>Use the corner handles to resize a selected object.</Li>
          <Li>Press <Code>Delete</Code> or click the toolbar trash icon to remove the selected object.</Li>
          <Li>Use the zoom slider or scroll wheel to zoom in and out.</Li>
        </Ul>

        {H('Scene list (left panel)')}
        <Ul>
          <Li>Click a scene name to switch to it.</Li>
          <Li>Use the <Code>+</Code> button to add a new scene.</Li>
          <Li>Double-click a scene name to rename it.</Li>
          <Li>Right-click or use the icon to delete a scene (cannot be undone).</Li>
        </Ul>

        {H('Properties panel (right panel)')}
        <Ul>
          <Li>X / Y — position of the selected object's top-left corner.</Li>
          <Li>W / H — width and height in pixels.</Li>
          <Li>Opacity — 0 (invisible) to 1 (fully opaque).</Li>
          <Li>Z-Index — drawing order. Higher values appear on top.</Li>
          <Li>Name — used to target the object in events.</Li>
        </Ul>

        {H('Object types')}
        <Table
          rows={[
            ['Background', 'Full-scene image layer, always drawn first'],
            ['Sprite', 'General image object; can be animated'],
            ['Character', 'NPC or player avatar'],
            ['Item', 'Collectible or interactive prop'],
            ['Hotspot', 'Invisible trigger area for click/hover events'],
          ]}
        />

        {H('Setting a background image')}
        <P>
          Select a scene in the list and click the background image field in Scene Settings to choose
          an image from your Assets library.
        </P>

        <Tip>
          Design scenes at the game's target resolution (set in Settings Editor). Objects placed
          outside the scene bounds will not be visible in-game.
        </Tip>
      </>
    ),
  },

  event: {
    title: 'Event Editor',
    content: (
      <>
        <P>
          Events are the game's logic layer. Each event binds a <strong>trigger</strong> on a scene
          object to one or more <strong>actions</strong> that execute when the trigger fires.
        </P>

        {H('Creating an event')}
        <Ul>
          <Li>Select a scene from the left panel, then select an object within that scene.</Li>
          <Li>Click <Code>Add Event</Code> to open the event form.</Li>
          <Li>Choose a trigger type, add actions, then save.</Li>
        </Ul>

        {H('Triggers')}
        <Table
          rows={[
            ['click', 'Player clicks / taps on the object'],
            ['hover', "Mouse enters the object's area"],
            ['enter', 'Scene loads — fires once when player enters the scene'],
            ['exit', 'Fires when player leaves the scene'],
            ['keypress', 'A keyboard key is pressed (value = key name)'],
          ]}
        />

        {H('Actions')}
        <Table
          rows={[
            ['navigate_scene', 'Move to another scene — value = scene name or ID'],
            ['show_dialog', 'Display a dialogue box — value = text to show'],
            ['set_variable', 'Set a game variable — value = key=value (e.g. doorOpen=true)'],
            ['show_object', 'Make a hidden object visible — value = object name'],
            ['hide_object', 'Hide a visible object — value = object name'],
            ['play_sound', 'Play an audio asset — value = asset name or ID'],
            ['play_animation', 'Start a sprite animation — value = animation name'],
            ['stop_animation', 'Stop a running animation — value = animation name'],
          ]}
        />

        {H('Action chains')}
        <P>
          Multiple actions in one event execute in order from top to bottom. Use the drag handles
          to reorder them.
        </P>

        {H('Variables')}
        <P>
          Variables are key-value pairs stored in the runtime game state. Use{' '}
          <Code>set_variable</Code> to write them (e.g. <Code>collected_key=true</Code>) and
          condition checks in the Goal Editor to read them.
        </P>

        <Tip>
          Use <strong>Hotspot</strong> objects in the Scene Editor for invisible click areas — ideal
          for exit doors, floor triggers, and hidden items.
        </Tip>

        <Warn>
          Object names in actions must exactly match the name set in the Scene Editor's Properties
          panel. Names are case-sensitive.
        </Warn>
      </>
    ),
  },

  assets: {
    title: 'Assets Manager',
    content: (
      <>
        <P>
          The Assets Manager is the central library for all media files used in your game. Import
          images, audio, and video once, then reference them anywhere.
        </P>

        {H('Importing assets')}
        <Ul>
          <Li>Click <Code>Import</Code> (or the upload button) and select files from your device.</Li>
          <Li>Multiple files can be imported at once.</Li>
          <Li>Assets are stored as data URLs in the project file — no external paths needed.</Li>
        </Ul>

        {H('Supported formats')}
        <Table
          rows={[
            ['Images', 'PNG, JPG/JPEG, GIF, SVG, WebP'],
            ['Audio', 'MP3, OGG, WAV'],
            ['Video', 'MP4, WebM'],
          ]}
        />

        {H('Using assets')}
        <Ul>
          <Li>Drag an image from the library onto the Scene Editor canvas to place it.</Li>
          <Li>Select an image asset when setting a scene's background image.</Li>
          <Li>Reference audio asset names in Event Editor <Code>play_sound</Code> actions.</Li>
          <Li>Import sprite sheets here first, then slice them in the Sprite Manager.</Li>
        </Ul>

        {H('Asset cards')}
        <Ul>
          <Li>Images show a thumbnail preview.</Li>
          <Li>Hover over a card to see a larger preview.</Li>
          <Li>Click the trash icon to delete an asset (removes it from the library only; placed instances remain).</Li>
        </Ul>

        <Warn>
          Large images (over 2 MB) may slow down export. Compress images before importing for
          best performance.
        </Warn>

        <Tip>
          Use PNG with transparency for sprites and characters. Use JPG for scene backgrounds where
          transparency is not needed.
        </Tip>
      </>
    ),
  },

  ui: {
    title: 'UI Editor',
    content: (
      <>
        <P>
          The UI Editor lets you design the in-game HUD (Heads-Up Display) — dialogue boxes,
          inventory panels, health bars, buttons, and other overlay elements that appear on top
          of the game scene.
        </P>

        {H('Adding elements')}
        <Ul>
          <Li>Click a widget type in the left toolbar to add it to the canvas.</Li>
          <Li>Drag elements to reposition them.</Li>
          <Li>Select an element to edit its style properties in the right panel.</Li>
        </Ul>

        {H('Widget types')}
        <Table
          rows={[
            ['Text', 'Static or dynamic label'],
            ['Button', 'Clickable button with a label'],
            ['Image', 'An image from your Assets library'],
            ['Progress Bar', 'Visual progress indicator (e.g. health, stamina)'],
            ['Inventory Slot', "A slot in the player's inventory grid"],
          ]}
        />

        {H('Style properties')}
        <Ul>
          <Li><Code>Color</Code> — text color.</Li>
          <Li><Code>Background</Code> — fill color or transparent.</Li>
          <Li><Code>Font size</Code> — text size in pixels.</Li>
          <Li><Code>Border radius</Code> — rounds corners.</Li>
          <Li><Code>Opacity</Code> — element transparency.</Li>
        </Ul>

        <Tip>
          UI elements are drawn on top of all scene content. Use the Z-Index property to control
          the stacking order when elements overlap.
        </Tip>
      </>
    ),
  },

  sprite: {
    title: 'Sprite Manager',
    content: (
      <>
        <P>
          The Sprite Manager handles sprite sheets and frame-based animations. Import a sprite
          sheet, slice it into individual frames, then define named animation sequences for use
          in scenes.
        </P>

        {H('Workflow')}
        <Ul>
          <Li>Import a sprite sheet image via the Assets Manager first.</Li>
          <Li>In the Sprite Manager, click <Code>Import Sprite Sheet</Code> and select the image.</Li>
          <Li>Set the number of rows and columns to slice the sheet into frames.</Li>
          <Li>Create named animations by specifying a start frame, end frame, and FPS.</Li>
          <Li>Preview animations with the playback controls.</Li>
        </Ul>

        {H('━━ Sprite sheet format requirements ━━')}
        <P>
          <strong className="text-indigo-300">
            The builder expects a uniform-grid sprite sheet. All frames must be the same size.
          </strong>
        </P>

        <Table
          rows={[
            ['File format', 'PNG strongly recommended (supports transparency). JPG/WebP accepted.'],
            ['Grid layout', 'Uniform grid — every frame is the same pixel width and height.'],
            ['Frame order', 'Left → right, top → bottom. Frame 0 = top-left cell.'],
            ['Transparency', 'Use PNG with an alpha (RGBA) channel for transparent backgrounds.'],
            ['Padding', 'No padding between frames (the slicer divides width÷cols, height÷rows).'],
            ['Dimensions', 'Sheet width must be evenly divisible by column count; height by row count.'],
            ['Recommended size', '64×64, 128×128, or 256×256 px per frame (powers of 2 = best GPU performance).'],
            ['Max sheet size', 'Keep total sheet under 4096×4096 px to stay within GPU texture limits.'],
            ['Color depth', '8-bit RGBA (32-bit PNG). Avoid 16-bit or indexed-color PNGs.'],
          ]}
        />

        {H('Frame numbering example')}
        <P>
          A <strong>4 columns × 3 rows</strong> sheet has 12 frames numbered like this:
        </P>
        <pre className="text-xs text-gray-300 bg-gray-800 rounded-lg p-3 mb-3 font-mono leading-loose overflow-x-auto">
{`┌──────┬──────┬──────┬──────┐
│  0   │  1   │  2   │  3   │  ← row 0
├──────┼──────┼──────┼──────┤
│  4   │  5   │  6   │  7   │  ← row 1
├──────┼──────┼──────┼──────┤
│  8   │  9   │  10  │  11  │  ← row 2
└──────┴──────┴──────┴──────┘`}
        </pre>

        {H('Animation examples')}
        <Table
          rows={[
            ['Idle (loop)', 'frames 0–3, 8 FPS, loop = true'],
            ['Walk cycle', 'frames 4–7, 12 FPS, loop = true'],
            ['Attack (once)', 'frames 8–11, 10 FPS, loop = false'],
          ]}
        />

        {H('Recommended tools for creating sprite sheets')}
        <Ul>
          <Li><strong>Aseprite</strong> — purpose-built pixel art & animation tool with sprite sheet export.</Li>
          <Li><strong>TexturePacker</strong> — batch packs individual frame images into a uniform grid sheet.</Li>
          <Li><strong>GIMP / Photoshop</strong> — manual layout using a grid guide.</Li>
          <Li><strong>Piskel</strong> — free browser-based sprite editor with sheet export.</Li>
        </Ul>

        <Warn>
          If the slicer grid does not line up with your art, check that the sheet dimensions are
          exactly divisible by your row/column counts. A 130 px wide sheet cannot be divided into
          4 equal columns — use 128 px instead.
        </Warn>

        <Tip>
          Export sprite sheets with a transparent background (PNG, alpha channel) so the builder
          can composite them over any scene background without white or black fringing.
        </Tip>
      </>
    ),
  },

  settings: {
    title: 'Settings Editor',
    content: (
      <>
        <P>
          The Settings Editor defines global game configuration and the player-adjustable settings
          menu shown in-game.
        </P>

        {H('Game metadata')}
        <Table
          rows={[
            ['Title', "The game's display name (also used in the exported project)"],
            ['Author', 'Creator name shown in credits'],
            ['Version', 'Semantic version string (e.g. 1.0.0)'],
            ['Description', 'Short blurb shown on store pages or README'],
          ]}
        />

        {H('Resolution')}
        <P>
          Sets the game canvas size. All scene objects are designed at this resolution. Common
          choices:
        </P>
        <Ul>
          <Li><Code>1280 × 720</Code> — HD 16:9 (default, best for most adventure games)</Li>
          <Li><Code>1920 × 1080</Code> — Full HD 16:9</Li>
          <Li><Code>800 × 600</Code> — classic 4:3 retro ratio</Li>
        </Ul>

        {H('Starting scene')}
        <P>
          The scene the game loads when the player starts a new game. Set this to your intro or
          title scene. If unset, the engine defaults to the first scene in the list.
        </P>

        {H('Player settings')}
        <P>
          Define settings players can change in-game (e.g. volume, difficulty, text speed). Each
          setting has a type, default value, and optional min/max range.
        </P>
        <Table
          rows={[
            ['number', 'Slider or numeric input (requires min and max)'],
            ['boolean', 'Toggle on/off'],
            ['string', 'Text selection or free text'],
          ]}
        />

        <Tip>
          Click <Code>Save Changes</Code> after editing to apply settings to the project. Settings
          are also embedded in the exported game.
        </Tip>
      </>
    ),
  },

  titlescreen: {
    title: 'Title Screen Editor',
    content: (
      <>
        <P>
          The Title Screen Editor designs the game's main menu — the first thing players see when
          launching your game.
        </P>

        {H('Layout')}
        <Ul>
          <Li>Left panel — edit background color/image, title text, subtitle, and button styles.</Li>
          <Li>Right area — live preview of the title screen at a scaled resolution.</Li>
        </Ul>

        {H('Background')}
        <Ul>
          <Li>Choose a solid background color using the color picker.</Li>
          <Li>Or set a background image from your Assets library for a richer title screen.</Li>
        </Ul>

        {H('Title & subtitle')}
        <Ul>
          <Li>The title text defaults to your game's name (from Settings).</Li>
          <Li>Adjust font size and color separately for title and subtitle.</Li>
        </Ul>

        {H('Menu buttons')}
        <P>Default buttons: New Game, Load Game, Settings, Quit. You can add, rename, reorder, or
        delete buttons.</P>
        <Table
          rows={[
            ['new_game', 'Starts a new game from the starting scene'],
            ['load_game', 'Opens the save slot selection screen'],
            ['settings', 'Opens the player settings dialog'],
            ['quit', 'Closes the application (desktop only)'],
            ['custom', 'Any custom action name for extended logic'],
          ]}
        />

        <Tip>
          The title screen is always shown before the starting scene. Use it to set the tone of
          your game with a strong background illustration and music (wired via an <Code>enter</Code>{' '}
          event on the title screen scene).
        </Tip>
      </>
    ),
  },

  stage: {
    title: 'Stage Editor',
    content: (
      <>
        <P>
          Stages (also called levels) are the top-level progression units of your game. Each stage
          contains one or more scenes and has a starting scene that loads when the stage begins.
        </P>

        {H('Stage list (left panel)')}
        <Ul>
          <Li>Stage 1 is created automatically for every new project.</Li>
          <Li>Click <Code>Add Stage</Code> to create a new stage.</Li>
          <Li>Use the up/down arrows to reorder stages.</Li>
          <Li>Click the trash icon to delete a stage (scenes are not deleted, only the association).</Li>
        </Ul>

        {H('Stage detail (right panel)')}
        <Ul>
          <Li><strong>Name</strong> — displayed in the Goal Editor and export project.</Li>
          <Li><strong>Starting Scene</strong> — the scene that loads when this stage begins.</Li>
          <Li><strong>Scene Assignment</strong> — tick checkboxes to associate scenes with this stage. Scenes can belong to multiple stages.</Li>
        </Ul>

        {H('Stage progression')}
        <P>
          The game engine advances through stages in order when a stage's goal conditions are met
          (defined in the Goal Editor). On stage completion, the engine either advances to the next
          stage or executes the configured completion action.
        </P>

        <Tip>
          Organise your game into logical chapters using stages — e.g. Stage 1: The Village,
          Stage 2: The Forest, Stage 3: The Castle. Each stage's starting scene is the player's
          entry point.
        </Tip>
      </>
    ),
  },

  goal: {
    title: 'Goal Editor',
    content: (
      <>
        <P>
          Goals define the conditions that must be met to complete a stage. When all conditions
          are satisfied the engine executes the configured completion action.
        </P>

        {H('Creating goals')}
        <Ul>
          <Li>Select a stage from the left dropdown.</Li>
          <Li>Click <Code>Add Goal</Code> to create a completion condition for that stage.</Li>
          <Li>A stage can have multiple goals combined with AND or OR logic.</Li>
        </Ul>

        {H('Condition types')}
        <Table
          rows={[
            ['variable_equals', 'A game variable matches a specific value (e.g. doorOpen = true)'],
            ['scene_visited', 'The player has visited a specific scene'],
            ['item_collected', 'A variable tracking an item equals a collected state'],
            ['event_triggered', 'A named event has fired at least once'],
          ]}
        />

        {H('Operators')}
        <Table
          rows={[
            ['equals', 'Exact match'],
            ['not_equals', 'Does not match'],
            ['greater_than', 'Numeric comparison'],
            ['less_than', 'Numeric comparison'],
            ['contains', 'String contains substring'],
          ]}
        />

        {H('Logic combinator')}
        <Ul>
          <Li><Code>AND</Code> — all conditions must be true simultaneously.</Li>
          <Li><Code>OR</Code> — any single condition being true completes the stage.</Li>
        </Ul>

        {H('Completion actions')}
        <Table
          rows={[
            ['advance_stage', 'Load the next stage in order'],
            ['end_game', 'Show the end-game screen and stop'],
            ['show_dialog', 'Display a message, then stay on current stage'],
          ]}
        />

        <Tip>
          Use <Code>variable_equals</Code> conditions paired with <Code>set_variable</Code> events
          for flexible goal tracking — e.g. set <Code>boss_defeated=true</Code> when the player
          triggers a boss encounter event, then check that variable as the stage goal.
        </Tip>
      </>
    ),
  },

  cursor: {
    title: 'Cursor Editor',
    content: (
      <>
        <P>
          The Cursor Editor lets you replace the default browser cursor with a custom image for
          each interaction state, giving your game a polished, thematic look.
        </P>

        {H('Cursor states')}
        <Table
          rows={[
            ['Default', 'Standard cursor shown when hovering over non-interactive areas'],
            ['Hover', 'Shown when the cursor is over a clickable object'],
            ['Interact', 'Shown when an action is actively in progress'],
          ]}
        />

        {H('Setting up a cursor')}
        <Ul>
          <Li>Select a state tab (Default / Hover / Interact).</Li>
          <Li>Click <Code>Upload Image</Code> to import a PNG cursor image.</Li>
          <Li>Click on the image preview to set the <strong>hotspot</strong> — the pixel that registers as the click point.</Li>
          <Li>The live preview panel shows how the cursor will look against a dark background.</Li>
        </Ul>

        {H('Cursor image requirements')}
        <Table
          rows={[
            ['Format', 'PNG with transparency (alpha channel)'],
            ['Size', '32×32 px recommended; max 128×128 px'],
            ['Hotspot', 'The active click point — usually the tip of a pointer (0,0) or center of a crosshair'],
          ]}
        />

        {H('Hotspot explained')}
        <P>
          The hotspot is the exact pixel within your cursor image that maps to the mouse position.
          For an arrow cursor, set hotspot to <Code>(0, 0)</Code> (top-left tip). For a crosshair,
          set it to the center (e.g. <Code>16, 16</Code> for a 32×32 image).
        </P>

        <Tip>
          Design cursors at 32×32 px for crisp rendering across all screen densities. Larger
          cursors may appear blurry on high-DPI displays in some browsers.
        </Tip>

        <Warn>
          Custom CSS cursors are supported in all modern browsers but may be ignored on mobile/touch
          devices where a hardware cursor is absent.
        </Warn>
      </>
    ),
  },

  preview: {
    title: 'Preview Game',
    content: (
      <>
        <P>
          The Preview Game manager runs your game directly inside the Adventure Game Builder so you
          can test scenes, events, and logic without leaving the editor.
        </P>

        {H('Controls')}
        <Table
          rows={[
            ['Play', 'Starts the game from the configured starting scene'],
            ['Stop', 'Stops the game and clears the canvas'],
            ['Reset', 'Restarts from the beginning, clearing all game state'],
            ['Fullscreen', 'Expands the preview to fill the screen (Esc or button to exit)'],
          ]}
        />

        {H('What the preview tests')}
        <Ul>
          <Li>Scene rendering — backgrounds, objects, z-order, visibility.</Li>
          <Li>Click events — trigger → action chains on objects.</Li>
          <Li>Scene navigation — <Code>navigate_scene</Code> actions.</Li>
          <Li>Dialogue — <Code>show_dialog</Code> text boxes (click to dismiss).</Li>
          <Li>Variable state — <Code>set_variable</Code> / <Code>show_object</Code> / <Code>hide_object</Code>.</Li>
          <Li>Sound playback — <Code>play_sound</Code> using imported audio assets.</Li>
          <Li>Enter-scene events — fire when a scene is first visited.</Li>
        </Ul>

        {H('Preview limitations')}
        <Ul>
          <Li>Title screen is not shown — the preview starts directly at the starting scene.</Li>
          <Li>Goal conditions are not checked (use the Goal Editor to review them).</Li>
          <Li>Save/load slots are not active in preview mode.</Li>
        </Ul>

        <Tip>
          Set a <strong>Starting Scene</strong> in the Settings Editor before previewing. If none
          is set, the preview loads the first scene in the scene list.
        </Tip>

        <Warn>
          Changes made in other editors while the game is playing take effect on the <em>next
          Play</em> — click Stop then Play again to pick up the latest changes.
        </Warn>
      </>
    ),
  },

  character: {
    title: 'Character Editor',
    content: (
      <>
        <P>
          The Character Editor lets you define your game&apos;s <strong>main player character</strong> — their
          name, sprite size, and which sprite sheet animations play while walking in each direction.
          You can then place the character&apos;s starting position per scene from the Scene Editor.
        </P>

        {H('Character info')}
        <Table
          rows={[
            ['Name', "The character's display name (shown in the Scene Editor marker)."],
            ['Description', 'Optional notes about the character — not shown in-game.'],
            ['Width / Height', 'Pixel size of the character sprite on screen.'],
            ['Default Facing', 'The direction the character faces when no animation is playing.'],
          ]}
        />

        {H('Walking animations')}
        <P>
          Assign one animation from a sprite sheet to each of the four walking directions:
          <strong> Up</strong>, <strong>Down</strong>, <strong>Left</strong>, and <strong>Right</strong>.
        </P>
        <Ul>
          <Li>Select a sprite sheet (create them first in the <strong>Sprites</strong> editor).</Li>
          <Li>Then select the specific animation from that sheet for the direction.</Li>
          <Li>The status badge turns green when an animation is fully assigned.</Li>
          <Li>Click <strong>✕</strong> on a direction card to clear that assignment.</Li>
        </Ul>

        {H('Setting the start position per scene')}
        <P>
          Each scene can independently define where the character appears:
        </P>
        <Ul>
          <Li>Open the <strong>Scene Editor</strong> and select a scene.</Li>
          <Li>In the right-hand <strong>Properties</strong> panel, scroll to <strong>Character Start</strong>.</Li>
          <Li>Toggle the checkbox to enable the character in that scene.</Li>
          <Li>Set the X / Y position and the initial facing direction.</Li>
          <Li>A dashed blue marker previews the character placement on the canvas.</Li>
        </Ul>

        <Tip>
          Create and name your sprite sheet animations descriptively (e.g. "walk-up", "walk-down")
          before coming here — it makes selecting them much easier.
        </Tip>

        <Warn>
          The character is a single shared definition across all scenes. If you change the sprite
          size here, the placement markers in all scenes will reflect the new size immediately.
        </Warn>
      </>
    ),
  },

  cinematic: {
    title: 'Cinematic Editor',
    content: (
      <>
        <P>
          The Cinematic Editor lets you create scripted cutscenes — sequences of character
          movements, dialogue, and actions that play out automatically when triggered by an event.
        </P>

        {H('Creating a cinematic')}
        <Ul>
          <Li>Click <Code>New Cinematic</Code> in the left panel to create one.</Li>
          <Li>Give it a name and select which scene it takes place in.</Li>
          <Li>Add steps in the center timeline, then configure each step in the right panel.</Li>
        </Ul>

        {H('Step types')}
        <Table
          rows={[
            ['Walk To', 'Moves a character to a target X/Y position in the scene'],
            ['Talk', 'Shows a dialogue line attributed to a specific character'],
            ['Action', 'Displays a floating action label (e.g. "attacks", "gives gift") for 2s'],
            ['Wait', 'Pauses the sequence for a configurable number of seconds'],
            ['Show Dialog', 'Shows a plain dialog box without a named speaker'],
            ['Set Variable', 'Sets a game variable (key=value) mid-cinematic'],
            ['Play Sound', 'Plays an audio asset during the sequence'],
          ]}
        />

        {H('Reordering steps')}
        <P>
          Use the <Code>↑</Code> and <Code>↓</Code> arrow buttons on each step card to change the
          order of execution. Steps run from top to bottom.
        </P>

        {H('Completion action')}
        <P>
          When the last step finishes, the cinematic runs its <strong>Completion Action</strong>:
        </P>
        <Table
          rows={[
            ['Return to Game', 'Resumes normal gameplay after the cinematic'],
            ['Navigate to Scene', 'Loads a different scene when the cinematic ends'],
            ['Show Dialog', 'Displays a final dialog box'],
            ['Set Variable', 'Sets a variable as the final action'],
          ]}
        />

        {H('Triggering a cinematic')}
        <P>
          Link a cinematic to any event in the <strong>Event Editor</strong> using the{' '}
          <Code>Play Cinematic</Code> action and selecting the cinematic by name.
        </P>

        <Tip>
          Use cinematics for story moments — character introductions, item discoveries, scene
          transitions — to give your game a polished, narrative feel.
        </Tip>

        <Warn>
          NPC characters must be placed in the scene as <strong>Character</strong> objects with
          the NPC assigned before a cinematic can move them. Assign NPCs in the Scene Editor's
          object properties panel.
        </Warn>
      </>
    ),
  },

  export: {
    title: 'Export Game',
    content: (
      <>
        <P>
          The Export Game manager packages your project as a complete <strong>Vite sub-project</strong>{' '}
          — a self-contained ZIP that can be built into static HTML + JS files deployable on any
          HTTP server.
        </P>

        {H('What gets exported')}
        <Table
          rows={[
            ['index.html', 'Entry point with a canvas sized to your game resolution'],
            ['src/engine.js', 'Standalone game runtime (no external dependencies)'],
            ['src/game-data.json', 'Full serialised project — scenes, events, assets, settings'],
            ['src/main.js', 'Wires the engine to the canvas and starts the game'],
            ['vite.config.js', 'Vite configuration — builds to dist/'],
            ['package.json', 'Project manifest with dev / build / preview scripts'],
            ['README.md', 'Quick-start instructions'],
          ]}
        />

        {H('Building the export')}
        <Ul>
          <Li>Unzip the downloaded file into a folder.</Li>
          <Li>Run <Code>npm install</Code> to install Vite.</Li>
          <Li>Run <Code>npm run dev</Code> for a live development server at <Code>localhost:5173</Code>.</Li>
          <Li>Run <Code>npm run build</Code> to generate the <Code>dist/</Code> folder of static files.</Li>
          <Li>Deploy the <Code>dist/</Code> folder to any static hosting (Netlify, Vercel, GitHub Pages, S3…).</Li>
        </Ul>

        {H('Asset handling')}
        <P>
          All imported assets (images, audio, video) are embedded as Base64 data URLs inside{' '}
          <Code>game-data.json</Code>. No separate asset files are needed — the game is fully
          self-contained in the ZIP.
        </P>

        {H('Before exporting')}
        <Ul>
          <Li>Set <strong>Game Title</strong> in Settings — it becomes the ZIP filename and HTML title.</Li>
          <Li>Set a <strong>Starting Scene</strong> in Settings so the game knows where to begin.</Li>
          <Li>Test your game in the Preview manager before exporting.</Li>
        </Ul>

        <Tip>
          Run <Code>npm run preview</Code> after building to serve the <Code>dist/</Code> folder
          locally and verify the production build before deploying.
        </Tip>

        <Warn>
          Large assets (high-resolution images, long audio files) increase the size of{' '}
          <Code>game-data.json</Code>. Compress assets before importing to keep file sizes manageable.
        </Warn>
      </>
    ),
  },
}
