const { Alliance } = require('../db');

async function loadAlliances() {
    return await Alliance.find({});
}

async function saveAlliance(data) {
    return await Alliance.findOneAndUpdate(
        { groupName: data.groupName },
        data,
        { upsert: true, new: true }
    );
}

async function deleteAlliance(groupName) {
    return await Alliance.findOneAndDelete({ groupName });
}

async function findAlliance(groupName) {
    return await Alliance.findOne({ groupName });
}

module.exports = { loadAlliances, saveAlliance, deleteAlliance, findAlliance };