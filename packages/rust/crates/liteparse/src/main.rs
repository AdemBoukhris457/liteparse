use clap::{Parser, Subcommand, Args};
use liteparse_rs::extract;
use liteparse_rs::projection;


#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand, Debug)]
enum Commands {
    /// Extract raw text items from a PDF file (no grid projection)
    Extract(PdfCommand),
    /// Parse a PDF file: extract + grid projection, output projected pages as JSON
    Parse(PdfCommand),
}


#[derive(Args, Debug)]
struct PdfCommand {
    /// Specify the path to the PDF file
    #[arg(long)]
    pdf_path: String,

    /// Optionally specify a target page number
    #[arg(long)]
    page_num: Option<u32>,
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let cli = Cli::parse();

    match cli.command {
        Commands::Extract(cmd) => {
            extract::extract(&cmd.pdf_path, cmd.page_num)?;
        }
        Commands::Parse(cmd) => {
            let t0 = std::time::Instant::now();
            let pages = extract::extract_pages(&cmd.pdf_path, cmd.page_num)?;
            let t1 = std::time::Instant::now();
            let parsed_pages = projection::project_pages_to_grid(pages);
            let t2 = std::time::Instant::now();
            let json = serde_json::to_string(&parsed_pages)?;
            let t3 = std::time::Instant::now();
            println!("{}", json);
            eprintln!(
                "[rust-bin] extract: {:.1}ms, project: {:.1}ms, serialize: {:.1}ms, total: {:.1}ms",
                t1.duration_since(t0).as_secs_f64() * 1000.0,
                t2.duration_since(t1).as_secs_f64() * 1000.0,
                t3.duration_since(t2).as_secs_f64() * 1000.0,
                t3.duration_since(t0).as_secs_f64() * 1000.0,
            );
        }
    }

    Ok(())
}
