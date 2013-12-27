#!/bin/sh

# Automated preparation of special XPI build of Clippings for
# Portable Firefox/Thunderbird ("PE" stands for "portable edition")

script_name=`basename $0`
pe_install_manifest=install-pe.rdf
default_install_manifest=install-default.rdf
makefile_backup=Makefile.bak
utils_js_backup=utils.js.bak


print_usage ()
{
    echo "Usage: $script_name [option]
Options:
  -u    Reverse changes to source files modified by previous invocation
  -h    Display this help and exit" >&2
    exit 0
}


die ()
{
    echo "$script_name: $1" >&2 ; exit 1
}


prep_build ()
{
    echo "Preparing source files for Portable Firefox/Thunderbird build..."

    if [ -f "install.rdf" ] ; then
	mv install.rdf $default_install_manifest
    else
	die "Cannot find install.rdf"
    fi
    
    if [ -f "$pe_install_manifest" ] ; then   
	cp $pe_install_manifest install.rdf
    else
	die "Cannot find $pe_install_manifest"
    fi

    mv Makefile $makefile_backup
    sed -e "s/\(DIST_FILE=clippings\)-/\1-pe-/" $makefile_backup > Makefile
    
    root_build_dir=`pwd`
    cd chrome/content
    [ -f utils.js ] || { echo "$script_name: Cannot find utils.js" >&2 ; exit 1; }
    mv utils.js $utils_js_backup
    sed -e "s/\(PORTABLE_APP_BUILD: \)false/\1true/" $utils_js_backup > utils.js
    cd $root_build_dir

    echo "Done!"
    return 0
}


undo_prep ()
{
    echo "Undoing changes to source files..."

    [ -f $default_install_manifest -a -f $makefile_backup -a -f "chrome/content/$utils_js_backup" ] || die "Cannot find backup files"

    rm install.rdf
    mv $default_install_manifest install.rdf
    mv $makefile_backup Makefile
    root_build_dir=`pwd`
    cd chrome/content
    rm utils.js
    mv $utils_js_backup utils.js
    cd $root_build_dir

    echo "Done!"
    return 0
}


#
# Script execution starts here
#

opt_selected=


while getopts "hu" option
do
  case $option in
      u)  undo_prep ; opt_selected=1 ;;
      h)  print_usage ;; 
      \?) print_usage ;;
  esac
done
shift `expr $OPTIND - 1`

[ -z "$opt_selected" ] && prep_build

exit $?
