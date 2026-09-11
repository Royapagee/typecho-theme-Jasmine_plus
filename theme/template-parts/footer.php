<?php if (!defined('__TYPECHO_ROOT_DIR__')) exit; ?>

    </div>
</div>
<div style="height: px"></div>
<div class="container text-body-tertiary py-4 mb-4">
    <div class="row g-2">
        <div class="col-12">
            <i class="ti ti-copyright"></i> <?php $this->options->title() ?>. All Rights Reserved. <a href="https://www.sanji.one" rel="nofollow" target="_blank">Theme Jasmine_Pic by 罗伊</a>
        </div>
        <div class="col-12">
            <?php $this->options->customFooter(); ?>
        </div>
    </div>
</div>
<script src="<?php $this->options->themeUrl('assets/bootstrap/js/bootstrap.bundle.min.js'); ?>"></script>
<script src="<?php $this->options->themeUrl('assets/main/main.js'); ?>"></script>
<script src="<?php $this->options->themeUrl('assets/main/pjax.js'); ?>"></script>

<?php $this->footer(); ?>

</body>
</html>
