use std::marker::PhantomData;

use crate::document::Document;
use crate::error::PdfiumError;
use crate::text_page::TextPage;

pub struct Page<'doc> {
    pub(crate) handle: pdfium_sys::FPDF_PAGE,
    pub(crate) _doc: PhantomData<&'doc Document>,
}

impl Page<'_> {
    pub fn width(&self) -> f32 {
        unsafe { pdfium_sys::FPDF_GetPageWidthF(self.handle) }
    }

    pub fn height(&self) -> f32 {
        unsafe { pdfium_sys::FPDF_GetPageHeightF(self.handle) }
    }

    pub fn rotation(&self) -> i32 {
        unsafe { pdfium_sys::FPDFPage_GetRotation(self.handle) }
    }

    pub fn text(&self) -> Result<TextPage<'_>, PdfiumError> {
        let handle = unsafe { pdfium_sys::FPDFText_LoadPage(self.handle) };
        if handle.is_null() {
            return Err(PdfiumError::OperationFailed);
        }
        Ok(TextPage {
            handle,
            _page: PhantomData,
        })
    }
}

impl Drop for Page<'_> {
    fn drop(&mut self) {
        unsafe { pdfium_sys::FPDF_ClosePage(self.handle) };
    }
}
