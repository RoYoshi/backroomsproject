/* Canonical Level 0 data. Edit here, then deliberately revise contentRevision/hash.
 * No runtime imports, random draws, physical ceilings or live spatial supports. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.TFB_LEVEL0=factory();})(typeof self!=='undefined'?self:this,function(){'use strict';
const definition={
  "schemaVersion": 1,
  "assetId": "world:level0",
  "contentRevision": "v23.3.6-flat-compat-1",
  "contentHash": "5b07af1fe27222982b860d5ebc912c3894459fa65441d46e7f2d9eb7f278bc77",
  "geometryMode": "flat-compat",
  "units": "legacy-world-unit",
  "bounds": {
    "min": {
      "x": 0,
      "y": 0,
      "z": null
    },
    "max": {
      "x": 9216,
      "y": 6912,
      "z": null
    }
  },
  "verticalExtent": "UNSPECIFIED — NOT SPATIAL GEOMETRY",
  "spatialRecords": null,
  "materials": [
    "carpet",
    "deep",
    "concrete",
    "wet"
  ],
  "defaultMaterial": "carpet",
  "roomMaterials": {
    "DAMP ROOMS": "wet",
    "LONG ROOM": "concrete",
    "DEEP CARPET": "deep"
  },
  "anchors": [
    {
      "id": "spawn:player",
      "x": 960,
      "y": 3264,
      "z": 0,
      "supportId": null
    },
    {
      "id": "anchor:reachability",
      "x": 1056,
      "y": 3264,
      "z": 0,
      "supportId": null
    }
  ],
  "exits": {
    "kind": "seeded-glitched-walls",
    "owner": "dev/sim_glue.js",
    "staticAnchors": []
  },
  "flat": {
    "width": 96,
    "height": 72,
    "tile": 96,
    "navCell": 48,
    "navRadius": 21,
    "rooms": [
      {
        "id": "room:01",
        "x": 3,
        "y": 27,
        "w": 18,
        "h": 18,
        "name": "YELLOW HALL",
        "code": "01"
      },
      {
        "id": "room:02",
        "x": 25,
        "y": 25,
        "w": 19,
        "h": 20,
        "name": "REPEATING ROOMS",
        "code": "02"
      },
      {
        "id": "room:03",
        "x": 49,
        "y": 28,
        "w": 18,
        "h": 17,
        "name": "SEGMENTED ROOMS",
        "code": "03"
      },
      {
        "id": "room:04",
        "x": 25,
        "y": 7,
        "w": 20,
        "h": 12,
        "name": "HUMMING ROOMS",
        "code": "04"
      },
      {
        "id": "room:05",
        "x": 4,
        "y": 7,
        "w": 17,
        "h": 12,
        "name": "NORTH ROOMS",
        "code": "05"
      },
      {
        "id": "room:06",
        "x": 50,
        "y": 7,
        "w": 25,
        "h": 11,
        "name": "LONG ROOM",
        "code": "06"
      },
      {
        "id": "room:07",
        "x": 4,
        "y": 50,
        "w": 18,
        "h": 13,
        "name": "BLACKOUT ZONE",
        "code": "07"
      },
      {
        "id": "room:08",
        "x": 27,
        "y": 51,
        "w": 18,
        "h": 12,
        "name": "DAMP ROOMS",
        "code": "08"
      },
      {
        "id": "room:09",
        "x": 51,
        "y": 51,
        "w": 18,
        "h": 12,
        "name": "RED ROOMS",
        "code": "09"
      },
      {
        "id": "room:10",
        "x": 73,
        "y": 27,
        "w": 19,
        "h": 18,
        "name": "ARCH GALLERY",
        "code": "10"
      },
      {
        "id": "room:11",
        "x": 77,
        "y": 7,
        "w": 15,
        "h": 14,
        "name": "PILLAR HALL",
        "code": "11"
      },
      {
        "id": "room:12",
        "x": 73,
        "y": 51,
        "w": 19,
        "h": 13,
        "name": "DEEP CARPET",
        "code": "12"
      }
    ],
    "floorCarves": [
      [
        20,
        33,
        6,
        4
      ],
      [
        43,
        34,
        7,
        4
      ],
      [
        66,
        34,
        8,
        4
      ],
      [
        21,
        56,
        7,
        4
      ],
      [
        44,
        57,
        8,
        4
      ],
      [
        68,
        56,
        6,
        4
      ],
      [
        19,
        11,
        7,
        4
      ],
      [
        44,
        11,
        7,
        4
      ],
      [
        74,
        11,
        4,
        4
      ],
      [
        10,
        18,
        4,
        10
      ],
      [
        32,
        18,
        4,
        8
      ],
      [
        57,
        17,
        4,
        12
      ],
      [
        82,
        20,
        4,
        8
      ],
      [
        10,
        44,
        4,
        7
      ],
      [
        33,
        44,
        4,
        8
      ],
      [
        58,
        44,
        4,
        8
      ],
      [
        82,
        44,
        4,
        8
      ]
    ],
    "wallCarves": [
      [
        9,
        28,
        1,
        8
      ],
      [
        9,
        38,
        1,
        6
      ],
      [
        15,
        32,
        1,
        12
      ],
      [
        30,
        26,
        1,
        7
      ],
      [
        30,
        35,
        1,
        9
      ],
      [
        37,
        26,
        1,
        10
      ],
      [
        37,
        38,
        1,
        6
      ],
      [
        26,
        31,
        6,
        1
      ],
      [
        34,
        39,
        9,
        1
      ],
      [
        54,
        29,
        1,
        8
      ],
      [
        54,
        39,
        1,
        5
      ],
      [
        61,
        29,
        1,
        6
      ],
      [
        61,
        37,
        1,
        7
      ],
      [
        50,
        34,
        5,
        1
      ],
      [
        57,
        40,
        9,
        1
      ],
      [
        31,
        8,
        1,
        8
      ],
      [
        38,
        10,
        1,
        8
      ],
      [
        26,
        13,
        6,
        1
      ],
      [
        34,
        15,
        10,
        1
      ],
      [
        10,
        8,
        1,
        8
      ],
      [
        16,
        10,
        1,
        8
      ],
      [
        5,
        13,
        6,
        1
      ],
      [
        56,
        8,
        1,
        7
      ],
      [
        64,
        10,
        1,
        7
      ],
      [
        71,
        8,
        1,
        8
      ],
      [
        51,
        13,
        6,
        1
      ],
      [
        59,
        15,
        6,
        1
      ],
      [
        10,
        51,
        1,
        9
      ],
      [
        16,
        53,
        1,
        9
      ],
      [
        5,
        56,
        6,
        1
      ],
      [
        33,
        52,
        1,
        10
      ],
      [
        40,
        54,
        1,
        8
      ],
      [
        28,
        57,
        6,
        1
      ],
      [
        57,
        52,
        1,
        10
      ],
      [
        64,
        54,
        1,
        8
      ],
      [
        52,
        57,
        6,
        1
      ],
      [
        79,
        28,
        1,
        7
      ],
      [
        79,
        38,
        1,
        6
      ],
      [
        86,
        31,
        1,
        12
      ],
      [
        74,
        35,
        6,
        1
      ],
      [
        83,
        8,
        1,
        5
      ],
      [
        83,
        15,
        1,
        5
      ],
      [
        79,
        52,
        1,
        10
      ],
      [
        86,
        54,
        1,
        8
      ],
      [
        74,
        58,
        6,
        1
      ]
    ],
    "doorCarves": [
      [
        9,
        35,
        1,
        2
      ],
      [
        15,
        36,
        1,
        2
      ],
      [
        30,
        32,
        1,
        3
      ],
      [
        37,
        35,
        1,
        3
      ],
      [
        31,
        31,
        2,
        1
      ],
      [
        39,
        39,
        2,
        1
      ],
      [
        54,
        36,
        1,
        3
      ],
      [
        61,
        34,
        1,
        3
      ],
      [
        53,
        34,
        2,
        1
      ],
      [
        62,
        40,
        2,
        1
      ],
      [
        31,
        12,
        1,
        2
      ],
      [
        38,
        13,
        1,
        2
      ],
      [
        30,
        13,
        2,
        1
      ],
      [
        39,
        15,
        2,
        1
      ],
      [
        10,
        12,
        1,
        2
      ],
      [
        16,
        14,
        1,
        2
      ],
      [
        9,
        13,
        2,
        1
      ],
      [
        56,
        12,
        1,
        2
      ],
      [
        64,
        13,
        1,
        2
      ],
      [
        71,
        12,
        1,
        2
      ],
      [
        55,
        13,
        2,
        1
      ],
      [
        63,
        15,
        2,
        1
      ],
      [
        10,
        55,
        1,
        2
      ],
      [
        16,
        57,
        1,
        2
      ],
      [
        9,
        56,
        2,
        1
      ],
      [
        33,
        56,
        1,
        2
      ],
      [
        40,
        58,
        1,
        2
      ],
      [
        32,
        57,
        2,
        1
      ],
      [
        57,
        56,
        1,
        2
      ],
      [
        64,
        58,
        1,
        2
      ],
      [
        56,
        57,
        2,
        1
      ],
      [
        79,
        34,
        1,
        2
      ],
      [
        86,
        36,
        1,
        2
      ],
      [
        78,
        35,
        2,
        1
      ],
      [
        83,
        12,
        1,
        2
      ],
      [
        83,
        17,
        1,
        2
      ],
      [
        79,
        56,
        1,
        2
      ],
      [
        86,
        58,
        1,
        2
      ],
      [
        78,
        58,
        2,
        1
      ]
    ],
    "columns": [
      {
        "id": "column:01",
        "x": 53,
        "y": 9
      },
      {
        "id": "column:02",
        "x": 57,
        "y": 9
      },
      {
        "id": "column:03",
        "x": 61,
        "y": 9
      },
      {
        "id": "column:04",
        "x": 65,
        "y": 9
      },
      {
        "id": "column:05",
        "x": 69,
        "y": 9
      },
      {
        "id": "column:06",
        "x": 53,
        "y": 15
      },
      {
        "id": "column:07",
        "x": 57,
        "y": 15
      },
      {
        "id": "column:08",
        "x": 61,
        "y": 15
      },
      {
        "id": "column:09",
        "x": 65,
        "y": 15
      },
      {
        "id": "column:10",
        "x": 69,
        "y": 15
      }
    ],
    "pillarGrid": {
      "xs": [
        79.5,
        84.5,
        89.5
      ],
      "ys": [
        9.5,
        14.5,
        19.5
      ],
      "half": 28,
      "size": 56,
      "ids": [
        "pillar:01",
        "pillar:02",
        "pillar:03",
        "pillar:04",
        "pillar:05",
        "pillar:06",
        "pillar:07",
        "pillar:08",
        "pillar:09"
      ]
    },
    "lampRule": {
      "excludeRoomId": "room:07",
      "offset": 2,
      "stride": 5,
      "margin": 1,
      "center": 0.5
    },
    "lampIds": [
      "lamp:001",
      "lamp:002",
      "lamp:003",
      "lamp:004",
      "lamp:005",
      "lamp:006",
      "lamp:007",
      "lamp:008",
      "lamp:009",
      "lamp:010",
      "lamp:011",
      "lamp:012",
      "lamp:013",
      "lamp:014",
      "lamp:015",
      "lamp:016",
      "lamp:017",
      "lamp:018",
      "lamp:019",
      "lamp:020",
      "lamp:021",
      "lamp:022",
      "lamp:023",
      "lamp:024",
      "lamp:025",
      "lamp:026",
      "lamp:027",
      "lamp:028",
      "lamp:029",
      "lamp:030",
      "lamp:031",
      "lamp:032",
      "lamp:033",
      "lamp:034",
      "lamp:035",
      "lamp:036",
      "lamp:037",
      "lamp:038",
      "lamp:039",
      "lamp:040",
      "lamp:041",
      "lamp:042",
      "lamp:043",
      "lamp:044",
      "lamp:045",
      "lamp:046",
      "lamp:047",
      "lamp:048",
      "lamp:049",
      "lamp:050",
      "lamp:051",
      "lamp:052",
      "lamp:053",
      "lamp:054",
      "lamp:055",
      "lamp:056",
      "lamp:057",
      "lamp:058",
      "lamp:059",
      "lamp:060",
      "lamp:061",
      "lamp:062",
      "lamp:063",
      "lamp:064",
      "lamp:065",
      "lamp:066",
      "lamp:067",
      "lamp:068",
      "lamp:069",
      "lamp:070",
      "lamp:071",
      "lamp:072",
      "lamp:073",
      "lamp:074",
      "lamp:075",
      "lamp:076",
      "lamp:077",
      "lamp:078",
      "lamp:079",
      "lamp:080",
      "lamp:081",
      "lamp:082",
      "lamp:083",
      "lamp:084",
      "lamp:085",
      "lamp:086",
      "lamp:087",
      "lamp:088",
      "lamp:089",
      "lamp:090"
    ],
    "propDefs": [
      {
        "id": "L1",
        "type": "low",
        "kind": "counter",
        "tx": 17,
        "ty": 34,
        "tw": 3,
        "th": 1,
        "depth": 48,
        "conceal": true
      },
      {
        "id": "L2",
        "type": "low",
        "kind": "shelf",
        "tx": 40,
        "ty": 34,
        "tw": 3,
        "th": 1,
        "depth": 44,
        "conceal": true
      },
      {
        "id": "L3",
        "type": "low",
        "kind": "lowwall",
        "tx": 64,
        "ty": 33,
        "tw": 1,
        "th": 3,
        "depth": 40,
        "conceal": true
      },
      {
        "id": "L4",
        "type": "low",
        "kind": "counter",
        "tx": 34,
        "ty": 10,
        "tw": 3,
        "th": 1,
        "depth": 48,
        "conceal": true
      },
      {
        "id": "L5",
        "type": "low",
        "kind": "railing",
        "tx": 83,
        "ty": 32,
        "tw": 1,
        "th": 3,
        "depth": 14,
        "conceal": false
      },
      {
        "id": "L6",
        "type": "low",
        "kind": "counter",
        "tx": 35,
        "ty": 54,
        "tw": 3,
        "th": 1,
        "depth": 48,
        "conceal": true
      },
      {
        "id": "L7",
        "type": "low",
        "kind": "lowwall",
        "tx": 60,
        "ty": 57,
        "tw": 1,
        "th": 3,
        "depth": 40,
        "conceal": true
      },
      {
        "id": "L8",
        "type": "low",
        "kind": "machine",
        "tx": 81,
        "ty": 56,
        "tw": 3,
        "th": 1,
        "depth": 62,
        "conceal": false
      },
      {
        "id": "U1",
        "type": "under",
        "kind": "table",
        "tx": 12,
        "ty": 52,
        "tw": 3,
        "th": 1,
        "depth": 62,
        "conceal": false
      },
      {
        "id": "U2",
        "type": "under",
        "kind": "bench",
        "tx": 50,
        "ty": 37,
        "tw": 3,
        "th": 1,
        "depth": 46,
        "conceal": false
      },
      {
        "id": "G1",
        "type": "gap",
        "kind": "hole",
        "tx": 9,
        "ty": 31,
        "tw": 1,
        "th": 1,
        "axis": "x"
      },
      {
        "id": "G2",
        "type": "gap",
        "kind": "hole",
        "tx": 37,
        "ty": 29,
        "tw": 1,
        "th": 1,
        "axis": "x"
      },
      {
        "id": "G3",
        "type": "gap",
        "kind": "hole",
        "tx": 61,
        "ty": 31,
        "tw": 1,
        "th": 1,
        "axis": "x"
      },
      {
        "id": "G4",
        "type": "gap",
        "kind": "hole",
        "tx": 28,
        "ty": 13,
        "tw": 1,
        "th": 1,
        "axis": "y"
      },
      {
        "id": "G5",
        "type": "gap",
        "kind": "hole",
        "tx": 86,
        "ty": 33,
        "tw": 1,
        "th": 1,
        "axis": "x"
      },
      {
        "id": "G6",
        "type": "gap",
        "kind": "hole",
        "tx": 33,
        "ty": 53,
        "tw": 1,
        "th": 1,
        "axis": "x"
      },
      {
        "id": "W1",
        "type": "window",
        "kind": "window",
        "tx": 30,
        "ty": 38,
        "tw": 1,
        "th": 1,
        "axis": "x",
        "depth": 40,
        "conceal": false
      },
      {
        "id": "W2",
        "type": "window",
        "kind": "window",
        "tx": 79,
        "ty": 41,
        "tw": 1,
        "th": 1,
        "axis": "x",
        "depth": 40,
        "conceal": false
      }
    ],
    "legacyItems": {
      "roomIds": [
        "room:02",
        "room:03",
        "room:04",
        "room:05",
        "room:06",
        "room:07",
        "room:08",
        "room:09"
      ],
      "ids": [
        "legacy-item:1",
        "legacy-item:2",
        "legacy-item:3",
        "legacy-item:4",
        "legacy-item:5",
        "legacy-item:6",
        "legacy-item:7",
        "legacy-item:8"
      ]
    },
    "patrol": [
      {
        "id": "patrol:1",
        "x": 7872,
        "y": 3264
      },
      {
        "id": "patrol:2",
        "x": 5664,
        "y": 3360
      },
      {
        "id": "patrol:3",
        "x": 8064,
        "y": 5376
      },
      {
        "id": "patrol:4",
        "x": 5664,
        "y": 1152
      }
    ]
  }
};
function freeze(v){if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
return freeze(definition);
});
