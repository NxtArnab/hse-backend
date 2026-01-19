import RecordType from "./recordType.model.js";

export const getRecordTypes = async (req, res) => {
    try{
        const types = await RecordType.find({ isActive: true })
        .select("key label template");
        res.json(types);     
    }catch(error){
        console.log(error);
        res.status(500).json({message:"Internal Server Error"});
    }
};
