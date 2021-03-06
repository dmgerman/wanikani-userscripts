/* jshint esversion: 6 */

function NiaiDB()
{
    this.override_db = {};
}


// #############################################################################
(function() {
   "use strict";

    NiaiDB.prototype = {
        constructor: NiaiDB,

        init: function(override_db)
        {
            this.override_db = override_db;

            // if (wkof)
            //     wkof.include(`ItemData`);
        },

        isKanjiInWK: function(kanji)
        {
            // WK started adding new kanji, treat unknown kanji gracefully
            if (!this.isKanjiInDB(kanji))
                return false;

            return (this.lookup_db[kanji].level !== 99);
        },

        isKanjiInDB: function(kanji)
        {
            return (kanji in this.lookup_db);
        },

        isKanjiLocked: function(kanji, level)
        {
            if (this.isKanjiInDB(kanji))
                return (this.lookup_db[kanji].level > level);
            else
                return true;
        },

        getInfo: function(kanji)
        {
            if (!this.isKanjiInDB(kanji))
                return {"meanings": "Not in DB!", "readings": "&nbsp;", level: "N/A"};

            let k_info = this.lookup_db[kanji];

            k_info.readings = k_info[k_info.important_reading];

            return k_info;
        },

        getSimilar: function(kanji, level, sources, min_score)
        {
            // use an object to override with later databases.
            let similar_kanji = {};

            sources.forEach(
                function(source)
                {
                    if (!(kanji in this[source.id]))
                        return;

                    this[source.id][kanji].forEach(
                        function(sim_info)
                        {
                            const hasScore = (
                                typeof sim_info !== `string` &&
                                `score` in sim_info
                            );

                            let sim_kanji = hasScore ? sim_info.kan : sim_info;
                            let score = source.base_score +
                                        (hasScore ? sim_info.score : 0.0);

                            if (!this.isKanjiInDB(sim_kanji))
                            {
                                console.log("Ignoring", kanji, ", not in DB yet!");
                                return;
                            }

                            const old_score = (sim_kanji in similar_kanji ?
                                               similar_kanji[sim_kanji].score :
                                               0.0);

                            if (score > min_score || (score > 0.0 && old_score > 0.0))
                            {
                                similar_kanji[sim_kanji] = {
                                    "kan": sim_kanji,
                                    "score": score,  // why was old_score used here?
                                    "locked": this.isKanjiLocked(sim_kanji, level)
                                };
                            }
                            else if (score < 0)
                            {
                                // negative scores are used to delete unwanted
                                // kanji to make it consistent across all DBs
                                // including the user's local db.
                                delete similar_kanji[sim_kanji];
                            }
                        },
                        this
                    );
                },
                this
            );

            let result = Object.values(similar_kanji);

            result.sort((a,b) => 2*Math.sign(b.score - a.score) +
                                 a.kan.localeCompare(b.kan))
                  .splice(19);

            return result.map((a) => a.kan);
        }
    };

    // Use the WK Open Framework to replace the offine DB of Niai
    // #########################################################################
    WK_Niai.prototype.update_wk_cache = function()
    {
        const wkof_config_locked = {
            wk_items: {
                options: {},
                filters: {
                    srs: {value: 'lock', invert: true},
                    item_type: 'kan'
                }
            }
        };

        const wkof_config_meaning = {
            wk_items: {
                options: {},
                filters: {
                    item_type: 'kan'
                }
            }
        };

        const _fix_info = function(items)
        {
            const type_items = wkof.ItemData.get_index(items, `slug`);

            similar_list.forEach((sim_kanji) => {
                if (sim_kanji in type_items)
                    $(`li[id$="${sim_kanji}"]`).removeClass(`locked`);
                else
                    $(`li[id$="${sim_kanji}"]`).addClass(`locked`);
            });
        };

        // Retrieve the latest meanings directly from WK
        const _fix_meanings = function(items)
        {
            const type_items = wkof.ItemData.get_index(items, `slug`);

            similar_list.forEach((sim_kanji) => {
                if (sim_kanji in type_items)
                {
                    $(`li[id$="${sim_kanji}"] li.niai_meaning`)
                        .text(type_items[sim_kanji].data.meanings[0].meaning);
                }
            });
        };

        wkof.ready(`ItemData`)
            .then(()=>
                    wkof.ItemData.get_items(wkof_config_locked)
                        .then(_fix_info)
            )
            .then(()=>
                    wkof.ItemData.get_items(wkof_config_meaning)
                        .then(_fix_meanings)
            );
    };
    // #########################################################################
}
());
// #############################################################################

// #############################################################################
NiaiDB.prototype.keisei_db      = JSON.parse(GM_getResourceText(`from_keisei_db`));
NiaiDB.prototype.old_script_db  = JSON.parse(GM_getResourceText(`old_script_db`));
NiaiDB.prototype.yl_radical_db  = JSON.parse(GM_getResourceText(`yl_radical_db`));
NiaiDB.prototype.stroke_dist_db = JSON.parse(GM_getResourceText(`stroke_dist_db`));
NiaiDB.prototype.noto_db        = JSON.parse(GM_getResourceText(`noto_db`));
NiaiDB.prototype.manual_db      = JSON.parse(GM_getResourceText(`manual_db`));
NiaiDB.prototype.lookup_db      = JSON.parse(GM_getResourceText(`lookup_db`));
// #############################################################################
