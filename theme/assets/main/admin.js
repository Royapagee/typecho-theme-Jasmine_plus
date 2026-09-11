function removeByPost() {
    if (window.location.href.includes('write-post')) {
        document.querySelectorAll(".removeByPost").forEach(function (element) {
            var tr = element.closest('tr');
            if (tr) {
                tr.style.display = 'none';
            }
        });
    }
}

function removeByPage() {
    if (window.location.href.includes('write-page')) {
        document.querySelectorAll(".removeByPage").forEach(function (element) {
            var tr = element.closest('tr');
            if (tr) {
                tr.style.display = 'none';
            }
        });
    }
}

function renameThumbnailField() {
    if (!window.location.href.includes('write-post')) return;

    var input = document.querySelector('input[name="fields[thumbnail]"]');
    if (!input) return;

    var container = input.closest('tr, .typecho-option, li');
    if (!container) return;

    var label = container.querySelector('label');
    if (label) label.textContent = '是否缩略图';

    var desc = container.querySelector('.description');
    if (desc) {
        desc.textContent = '图片地址-单张；0-不显示；1-多张显示';
    } else {
        var p = container.querySelector('p');
        if (p) p.textContent = '图片地址-单张；0-不显示；1-多张显示';
    }
}

document.addEventListener("DOMContentLoaded", function () {
    removeByPost();
    removeByPage();
    renameThumbnailField();
})
