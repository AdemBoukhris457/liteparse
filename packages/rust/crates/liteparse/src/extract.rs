use pdfium::{Library, TextPage};
use crate::types::{TextItem, Page};

/// Extract pages from a PDF file and return them as structured data.
pub fn extract_pages(pdf_path: &str, page_num: Option<u32>) -> Result<Vec<Page>, Box<dyn std::error::Error>> {
    let lib = Library::init();
    let document = lib.load_document(pdf_path, None)?;
    let page_count = document.page_count();
    let mut pages = Vec::new();

    for page_index in 0..page_count {
        if let Some(target_page) = page_num {
            if page_index as u32 + 1 != target_page {
                continue;
            }
        }

        let page = document.page(page_index)?;
        let text_page = page.text()?;
        let mut text_items = extract_page_text_items(&text_page)?;
        let page_height = page.height();

        // Convert from pdfium bottom-left origin to top-left origin
        for item in &mut text_items {
            item.y = page_height - item.y - item.height;
        }

        pages.push(Page {
            page_number: (page_index + 1) as usize,
            page_width: page.width(),
            page_height,
            text_items,
        });
    }

    Ok(pages)
}

/// Extract raw text items and print each page as a JSON-line object to stdout.
pub fn extract(pdf_path: &str, page_num: Option<u32>) -> Result<(), Box<dyn std::error::Error>> {
    let pages = extract_pages(pdf_path, page_num)?;
    for page in &pages {
        println!("{}", serde_json::to_string(page)?);
    }
    Ok(())
}

/// Use pdfium's text rect API (FPDFText_CountRects/GetRect/GetBoundedText) to extract
/// text segments. Pdfium auto-merges characters sharing the same baseline and font into
/// rectangular regions — this is the same approach pdfium-render's segments() used.
fn extract_page_text_items(text_page: &TextPage) -> Result<Vec<TextItem>, Box<dyn std::error::Error>> {
    let char_count = text_page.char_count();
    if char_count <= 0 {
        return Ok(Vec::new());
    }

    // Count rects for all characters — this caches the results for subsequent rect() calls
    let rect_count = text_page.count_rects(0, char_count);
    let mut text_items = Vec::new();

    for rect_idx in 0..rect_count {
        let rect = match text_page.rect(rect_idx) {
            Some(r) => r,
            None => continue,
        };

        let seg_text = text_page
            .bounded_text(rect.left, rect.top, rect.right, rect.bottom)
            .replace('\x02', "-");

        if seg_text.trim().is_empty() {
            continue;
        }

        let x = rect.left as f32;
        let y = rect.bottom as f32;
        let width = (rect.right - rect.left) as f32;
        let height = (rect.top - rect.bottom) as f32;

        // Find the first character in this rect to get font info and rotation
        let (font_name, font_size, rotation) = first_char_info_in_rect(text_page, &rect, height);

        text_items.push(TextItem {
            text: seg_text,
            x,
            y,
            width,
            height,
            rotation,
            font_name,
            font_size,
        });
    }

    Ok(text_items)
}

/// Get font name, font size, and rotation angle (degrees) from the first character
/// whose center falls within the given rect.
fn first_char_info_in_rect(
    text_page: &TextPage,
    rect: &pdfium::TextRect,
    fallback_height: f32,
) -> (Option<String>, Option<f32>, f32) {
    let char_count = text_page.char_count();
    for i in 0..char_count {
        let ch = match text_page.char_at(i) {
            Some(c) => c,
            None => continue,
        };

        if let Some(cb) = ch.char_box() {
            let cx = (cb.left + cb.right) / 2.0;
            let cy = (cb.bottom + cb.top) / 2.0;
            if cx >= rect.left && cx <= rect.right && cy >= rect.bottom && cy <= rect.top {
                let fname = ch.font_name();
                let fsize = ch.font_size() as f32;
                let fsize = if fsize > 0.0 { fsize } else { fallback_height };

                // angle() returns radians; convert to degrees
                let angle_rad = ch.angle();
                let mut angle_deg = if angle_rad >= 0.0 {
                    angle_rad.to_degrees()
                } else {
                    0.0
                };
                if angle_deg < 0.0 {
                    angle_deg += 360.0;
                }

                return (fname, Some(fsize), angle_deg);
            }
        }
    }

    (None, Some(fallback_height), 0.0)
}
