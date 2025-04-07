import { Command } from "commander"
import packageJson from "../package.json"
import { init } from "./commands/init"

async function main() {
    const program = new Command()
        .name("modelith")
        .description("evaluate your jupyter notebooks")
        .version(
            packageJson.version || "1.0.0",
            "-v, --version",
            "display the version number")

    program.addCommand(init)


    program.parse()


}


main()