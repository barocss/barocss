# Khronos Animated Triangle fixture

`AnimatedTriangle.gltf`, `AnimatedTriangle_animation.bin`, and `AnimatedTriangle_geometry.bin` come from [Khronos glTF Sample Assets, AnimatedTriangle/glTF](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/AnimatedTriangle/glTF). The JSON has trailing line whitespace removed; its data and the two binary buffers are unchanged.

The [sample metadata](https://github.com/KhronosGroup/glTF-Sample-Assets/blob/main/Models/AnimatedTriangle/README.md) states: © 2017, Public; Creative Commons Zero v1.0 Universal; Marco Hutter for everything. License: https://creativecommons.org/publicdomain/zero/1.0/

The Motion adapter reads only the selected animation's binary accessors. The browser scene draws its own fixed triangle geometry and does not load a glTF mesh.
