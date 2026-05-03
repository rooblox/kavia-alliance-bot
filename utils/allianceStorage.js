const { Alliance, AllianceListMessage } = require('../db');

async function loadAlliances() {
    return await Alliance.find({});
}

async function saveAlliance(data) {
    if (data.save) {
        // It's a Mongoose document — just save it directly
        return await data.save();
    }
    // It's a plain object — upsert
    const { _id, __v, ...updateData } = data;
    return await Alliance.findOneAndUpdate(
        { groupName: updateData.groupName },
        { $set: updateData },
        { upsert: true, new: true }
    );
}

async function deleteAlliance(groupName) {
    return await Alliance.findOneAndDelete({ groupName });
}

async function findAlliance(groupName) {
    return await Alliance.findOne({ groupName });
}

async function getListMessage() {
    return await AllianceListMessage.findOne({});
}

async function setListMessage(messageId, channelId) {
    return await AllianceListMessage.findOneAndUpdate(
        {},
        { messageId, channelId },
        { upsert: true, new: true }
    );
}

module.exports = { loadAlliances, saveAlliance, deleteAlliance, findAlliance, getListMessage, setListMessage };