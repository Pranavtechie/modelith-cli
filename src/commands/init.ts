import { Command } from "commander";


export const init = new Command()
    .name("init")
    .description("Initialize your project and install dependencies")
    .action(async () => {
        console.log('hi there');
    });