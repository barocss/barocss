# #1179 SOURCE numerical evidence audit

Read-only saved-data/source audit. No physics, reference, optimization, World or parent case was executed. SOURCE only; repeat/compiled still running at audit request.

## Verified result

SOURCE HINGE2_WORLD_GO:1200 accepted/qualified steps,10s; commands always empty; exact original fixed config matches completed-I0 request. The four zero extrema are measured every qualified step and are not a static/unreached pass. Motion, nonzero motor work, active/inactive constraints and raw changes are recorded below.

All1200 native records/request/reply locators,7201 raw416B frames, source-to-prior-projected1199 bit links, output/attempt bits, native store numeric correspondence and all declared stream hashes verified. Logical IPC offsets resolve through the explicit completed-I0 + current-process composite table; they are not offsets into the current-process raw file alone.

The acceptedStore JSON loses zero signs; raw body signs and request negativeZeroPaths were used for exact body-bit checks. This does not claim unsupported bit-complete hidden-store metadata beyond existing proof.

## Source assertion coverage

consumer.mjs records native result before reference comparison; requires callback1, qualifies every1200 reply and calls worldQuality each successful step. reference-reply.mjs gates selected SI errors/full parent replies. world-quality.mjs actively computes COM/plane/anchor/axis, global P/L including orbital terms, and reads raw+normalized parent AFTER budgets against initialzero; rejects contacts/events/CCD and wrong32/32/0 stats. Original motor metadata .5/.0001/.01 and ±.8 limits were checked on every actual pair. No all-graph/Viewer/public/release claim. Initial admission-context failure and repaired initial proof remain historical.

## Saved-data extraction

```json
{
  "stats": {
    "steps": 1200,
    "raw_frames": 7201,
    "bit_chain_links": 1199,
    "parent_certificates": 2400,
    "pose_law_evaluations": 2400,
    "contact_checks": 38400,
    "nonzero_v_states": 1200,
    "nonzero_omega_states": 1199,
    "max_abs_v": 0.00969340138729516,
    "max_abs_omega": 0.2499823569405808,
    "max_abs_position_change": 0.007893900599711498,
    "first_upper_limit_step": 197,
    "min_angle": 0.0004166666666666666,
    "max_angle": 0.8,
    "max_motor_work_j": 4.7493252237898124e-05,
    "unique_projected_hashes": 199,
    "phase_counts": {
      "source": 1200,
      "angular": 1200,
      "motor": 1200,
      "free": 1200,
      "postContact": 1200,
      "projected": 1200
    },
    "rowcounts": {
      "11": 2398,
      "12": 2
    }
  },
  "motors": [
    {
      "blocked": 1003,
      "nonzero_j": 197,
      "j_min": 0,
      "j_max": 0.0001,
      "nonzero_motor_work": 197
    },
    {
      "blocked": 1003,
      "nonzero_j": 197,
      "j_min": 0,
      "j_max": 0.0001,
      "nonzero_motor_work": 197
    }
  ],
  "samples": {
    "1": {
      "time": 0.008333333333333333,
      "angles": [
        0.0004166666666666666,
        0.0004166666666666666
      ],
      "position0": [
        -0.09999999782986113,
        0,
        0
      ],
      "orientation0": [
        0,
        0,
        -0.00010416666647828653,
        0.9999999945746528
      ],
      "velocity0": [
        5.208332730517046e-07,
        0,
        0
      ],
      "omega0": [
        0,
        0,
        -0.02499999728732672
      ],
      "motors": [
        {
          "inputAngleRad": 0,
          "targetSpeedRadps": 0.5,
          "limitRad": [
            -0.8,
            0.8
          ],
          "maxImpulseNms": 0.0001,
          "blocked": false,
          "impulseNms": 0.0001,
          "relativeSpeedBeforeRadps": 0,
          "relativeSpeedAfterRadps": 0.04999999999999999
        },
        {
          "inputAngleRad": 0,
          "targetSpeedRadps": 0.5,
          "limitRad": [
            -0.8,
            0.8
          ],
          "maxImpulseNms": 0.0001,
          "blocked": false,
          "impulseNms": 0.0001,
          "relativeSpeedBeforeRadps": 0,
          "relativeSpeedAfterRadps": 0.04999999999999999
        }
      ]
    },
    "100": {
      "time": 0.8333333333333334,
      "angles": [
        0.39791546289052054,
        0.39791546289052054
      ],
      "position0": [
        -0.09802731122652833,
        0,
        0
      ],
      "orientation0": [
        0,
        0,
        -0.09931487233722049,
        0.9950560567790347
      ],
      "velocity0": [
        0.004936215809538268,
        0,
        0
      ],
      "omega0": [
        0,
        0,
        -0.24974816544472
      ],
      "motors": [
        {
          "inputAngleRad": 0.3937487962238538,
          "targetSpeedRadps": 0.5,
          "limitRad": [
            -0.8,
            0.8
          ],
          "maxImpulseNms": 0.0001,
          "blocked": false,
          "impulseNms": 9.9736053516053e-07,
          "relativeSpeedBeforeRadps": 0.49950131973241974,
          "relativeSpeedAfterRadps": 0.5
        },
        {
          "inputAngleRad": 0.3937487962238538,
          "targetSpeedRadps": 0.5,
          "limitRad": [
            -0.8,
            0.8
          ],
          "maxImpulseNms": 0.0001,
          "blocked": false,
          "impulseNms": 9.9736053516053e-07,
          "relativeSpeedBeforeRadps": 0.49950131973241974,
          "relativeSpeedAfterRadps": 0.5
        }
      ]
    },
    "197": {
      "time": 1.6416666666666666,
      "angles": [
        0.8,
        0.8
      ],
      "position0": [
        -0.09210609940028851,
        0,
        0
      ],
      "orientation0": [
        0,
        0,
        -0.19866933079506124,
        0.9800665778412416
      ],
      "velocity0": [
        -1.734723475976807e-18,
        0,
        0
      ],
      "omega0": [
        0,
        0,
        0
      ],
      "motors": [
        {
          "inputAngleRad": 0.7979154628905215,
          "targetSpeedRadps": 0.5,
          "limitRad": [
            -0.8,
            0.8
          ],
          "maxImpulseNms": 0.0001,
          "blocked": false,
          "impulseNms": 1.8588426697647712e-06,
          "relativeSpeedBeforeRadps": 0.4990705786651176,
          "relativeSpeedAfterRadps": 0.5
        },
        {
          "inputAngleRad": 0.7979154628905215,
          "targetSpeedRadps": 0.5,
          "limitRad": [
            -0.8,
            0.8
          ],
          "maxImpulseNms": 0.0001,
          "blocked": false,
          "impulseNms": 1.8588426697647712e-06,
          "relativeSpeedBeforeRadps": 0.4990705786651176,
          "relativeSpeedAfterRadps": 0.5
        }
      ]
    },
    "198": {
      "time": 1.65,
      "angles": [
        0.8,
        0.8
      ],
      "position0": [
        -0.09210609940028851,
        0,
        0
      ],
      "orientation0": [
        0,
        0,
        -0.19866933079506124,
        0.9800665778412416
      ],
      "velocity0": [
        -4.768722839693971e-19,
        0,
        0
      ],
      "omega0": [
        0,
        0,
        1.224575815156214e-17
      ],
      "motors": [
        {
          "inputAngleRad": 0.8,
          "targetSpeedRadps": 0.5,
          "limitRad": [
            -0.8,
            0.8
          ],
          "maxImpulseNms": 0.0001,
          "blocked": true,
          "impulseNms": 0,
          "relativeSpeedBeforeRadps": 0,
          "relativeSpeedAfterRadps": 0
        },
        {
          "inputAngleRad": 0.8,
          "targetSpeedRadps": 0.5,
          "limitRad": [
            -0.8,
            0.8
          ],
          "maxImpulseNms": 0.0001,
          "blocked": true,
          "impulseNms": 0,
          "relativeSpeedBeforeRadps": 0,
          "relativeSpeedAfterRadps": 0
        }
      ]
    },
    "200": {
      "time": 1.6666666666666667,
      "angles": [
        0.8,
        0.8
      ],
      "position0": [
        -0.09210609940028851,
        0,
        0
      ],
      "orientation0": [
        0,
        0,
        -0.19866933079506124,
        0.9800665778412416
      ],
      "velocity0": [
        -4.768722839693973e-19,
        0,
        0
      ],
      "omega0": [
        0,
        0,
        1.2245758151562139e-17
      ],
      "motors": [
        {
          "inputAngleRad": 0.8,
          "targetSpeedRadps": 0.5,
          "limitRad": [
            -0.8,
            0.8
          ],
          "maxImpulseNms": 0.0001,
          "blocked": true,
          "impulseNms": 0,
          "relativeSpeedBeforeRadps": -2.4491516303124278e-17,
          "relativeSpeedAfterRadps": -2.4491516303124278e-17
        },
        {
          "inputAngleRad": 0.8,
          "targetSpeedRadps": 0.5,
          "limitRad": [
            -0.8,
            0.8
          ],
          "maxImpulseNms": 0.0001,
          "blocked": true,
          "impulseNms": 0,
          "relativeSpeedBeforeRadps": -2.4491516303124278e-17,
          "relativeSpeedAfterRadps": -2.4491516303124278e-17
        }
      ]
    },
    "1200": {
      "time": 10,
      "angles": [
        0.8,
        0.8
      ],
      "position0": [
        -0.09210609940028851,
        0,
        0
      ],
      "orientation0": [
        0,
        0,
        -0.19866933079506124,
        0.9800665778412416
      ],
      "velocity0": [
        -4.768722839693973e-19,
        0,
        0
      ],
      "omega0": [
        0,
        0,
        1.2245758151562139e-17
      ],
      "motors": [
        {
          "inputAngleRad": 0.8,
          "targetSpeedRadps": 0.5,
          "limitRad": [
            -0.8,
            0.8
          ],
          "maxImpulseNms": 0.0001,
          "blocked": true,
          "impulseNms": 0,
          "relativeSpeedBeforeRadps": -2.4491516303124278e-17,
          "relativeSpeedAfterRadps": -2.4491516303124278e-17
        },
        {
          "inputAngleRad": 0.8,
          "targetSpeedRadps": 0.5,
          "limitRad": [
            -0.8,
            0.8
          ],
          "maxImpulseNms": 0.0001,
          "blocked": true,
          "impulseNms": 0,
          "relativeSpeedBeforeRadps": -2.4491516303124278e-17,
          "relativeSpeedAfterRadps": -2.4491516303124278e-17
        }
      ]
    }
  },
  "parent_metric_maxima": {
    "actualFrameVelocityError": 3.0946339078708487e-17,
    "actualFrameLinearVelocityErrorMps": 1.734723475976807e-18,
    "actualFrameAngularVelocityErrorRadps": 3.0946339078708487e-17,
    "diagnosticMeasurementError": 2.220446049250313e-16,
    "diagnosticCorrectionError": 2.220446049250313e-16,
    "objectiveErrorJ": 2.0200294506692688e-20,
    "expectedTargetErrorRad": 2.220446049250313e-16,
    "objectiveMeasurementErrorJ": 3.4831065002524314e-21,
    "expectedFinalAngleErrorRad": 2.220446049250313e-16,
    "expectedPositionErrorM": 9.268549897485484e-18,
    "expectedQuaternionError": 2.2887833992611187e-16,
    "expectedLinearVelocityErrorMps": 5.204170427930421e-18,
    "expectedAngularVelocityErrorRadps": 5.551115123125783e-17,
    "rawNormalizedGeometryDifference": 1.1102230246251565e-16,
    "rawComChangeM": 0,
    "rawLinearMomentumChangeKgMps": 0,
    "rawAngularMomentumChangeKgM2ps": 0,
    "rawGeometricAngularMomentumChangeKgM2ps": 0,
    "normalizedComChangeM": 0,
    "normalizedLinearMomentumChangeKgMps": 0,
    "normalizedAngularMomentumChangeKgM2ps": 0,
    "normalizedGeometricAngularMomentumChangeKgM2ps": 0,
    "precisionMaxDifference": 1.410833468077949e-79,
    "scalarRepeatMaxDifferenceRad": 0
  },
  "verified_stream_hashes": {
    "controls.records.jsonl": "97fedbf66971e99811500ebaae49afdb7f94ae6ac971497bd8aff0a7653e62c2",
    "controls.bodies.raw": "0f5cbc09ed349ac93f3c720b96d8cef9c7ccf772a34b55b40947fd13a4228616",
    "completed-initial.stdin.raw": "4f0a978500157b8ec7922f597a580d07f9dbdc3e485d7a941cc32c0672518f86",
    "completed-initial.stdout.raw": "a61debde83d4b92a5946ad75f178daacc699813f3b7056a565548032cdc9c524",
    "reference.stdin.raw": "722957a4d20735710e210f517bd29d51777a923e003c5cdc2ca8f8583c9161d9",
    "reference.stdout.raw": "60f9e35dbed8dda3f6f3ebbff09ddd94fb55b9702e0f21cc2746daa76f79ee02",
    "main.bodies.raw": "d22e40616ede583bdd9526ce4e3d4f308658adfeea394e5b2845daa40d10d9f3",
    "main.records.jsonl": "40f7904c33d06f26090a41eb4c35322e1bdc6d49ea0bb4d4332414a9908edbe8",
    "main.native.jsonl": "29aa9e9ce5bd38bf658a3e94b396566a30e0904cd2d9020909d43714b46fed72",
    "reference.stderr.raw": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
  }
}
```
