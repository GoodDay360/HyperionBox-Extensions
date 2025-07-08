const get_episodes = async ($) => {
    try{
        const data = []
        let type_schema;
        const ep_selector = $("#epselector");
        if (ep_selector.html()){
            
            ep_selector.find(".seasonContainer").each((_, element) => {
                const ep_li = [];
                const season_container = $(element);
                season_container.find(".episodeList").find("a").each((index, element) => {
                    const ep_info = {}
                    const ep_ele = $(element);
                    ep_info.index = index;
                    ep_info.id = ep_ele.attr("data-episode");
                    ep_info.title = ep_ele.find("span").text().replace(/\s+/g, ' ').trim().replace("/\n/g","");
                    ep_li.push(ep_info);
                })
                data.push([ep_li]);
            })
            
            type_schema = 2;
        }else{
            data.push([[{
                index: 1,
                id: "full",
                title: "Full",
            }]])

            type_schema = 2;
        }

        
        return {code:200, message:"OK", result:{data,type_schema}}
    }catch(e){
        console.error(e)
        return {code:500, message:e};
    }fi
}

export default get_episodes;