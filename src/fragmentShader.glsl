#version 300 es
precision highp float;

in vec2 v_uv;
uniform vec2 u_resolution;
uniform sampler2D u_webcam;
uniform int u_nPasses;
uniform float u_nStrips;

out vec4 fragColor;

// Imagine cutting the image into nStrips strips along the x-axis. Then rearrange the strips so we take the first strip,
// then the last strip, then the second strip, then the second last strip, etc.
vec2 rearrangeStrips(vec2 uv, vec2 nStrips) {
    vec2 scaledUv = uv * nStrips;
    vec2 stripUv = floor(scaledUv);
    vec2 localUv = fract(scaledUv);
    vec2 isOdd = mod(stripUv, 2.0);
    return mix((stripUv / 2.0 + localUv) / nStrips, (nStrips - (stripUv + 1.0) / 2.0 + localUv) / nStrips, isOdd);
}

// 0..1..0
vec2 triangleWave(vec2 xy, float period) {
    return 1.0 - abs(fract(xy * period) * 2.0 - 1.0);
}

// Crop the texture to preserve its aspect ratio (object-fit: contain).
vec2 correctAspectRatio(vec2 uv, vec2 resolution, vec2 textureSize) {
    float canvasAspect = resolution.x / resolution.y;
    float textureAspect = textureSize.x / textureSize.y;
    vec2 scale = vec2(min(canvasAspect / textureAspect, 1.0), min(textureAspect / canvasAspect, 1.0));
    return (uv - 0.5) * scale + 0.5;
}

void main() {
    vec2 uv = v_uv;
    // Thinking in terms of the image, you’d want to start by correcting the aspect ratio, then mirroring the image,
    // then rearranging the strips. But since we’re operating in UV space, we need to work backwards.
    uv = vec2(uv.x, 1.0 - uv.y);
    for (int i = 0; i < u_nPasses; ++i) {
        // Note: this is equivalent to rearranging the strips along the x-axis
        //       with <u_nStrips, 1.0>, then the y-axis with <1.0, u_nStrips>…
        //       but twice as efficient :)
        uv = rearrangeStrips(uv, vec2(u_nStrips, u_nStrips));
    }
    uv = triangleWave(uv, pow(2.0, float(u_nPasses))); // Mirror with nPasses copies.
    uv = correctAspectRatio(uv, u_resolution, vec2(textureSize(u_webcam, 0)));
    uv = 1.0 - uv;

    fragColor = texture(u_webcam, uv);
}
